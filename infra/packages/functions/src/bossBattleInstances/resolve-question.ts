import { getBossBattleInstance } from "./repo.js";
import { BossBattleStatus } from "./types.js";
import { resolveQuestionCore } from "./resolve-question-service.js";

/**
 * POST /boss-battle-instances/{boss_instance_id}/resolve-question
 *
 * ResolveQuestion — HTTP handler for the public teacher-facing resolve endpoint.
 *
 * This handler is a thin wrapper around resolveQuestionCore (the shared service).
 * It is responsible for:
 *   - Extracting and validating the path parameter
 *   - Authorization (teacher / admin only)
 *   - Pre-call readiness check (timer expired or all answers received)
 *   - Formatting the HTTP response
 *
 * The core resolution logic (damage aggregation, heart penalties, state transition)
 * lives in resolveQuestionCore and is shared with the auto-resolve path in
 * tryAutoResolveBossQuestion (see auto-resolve.ts).
 *
 * Manual ResolveQuestion is still needed for:
 *   - Timed questions when the timer expires before all participants answer
 *   - Teacher force-resolve flows
 *   - Debugging / admin recovery
 *   - Fallback when auto-resolve failed
 *
 * Authorization: TEACHER or ADMIN only.
 * TODO: enforce teacher/admin auth via Cognito JWT claim validation middleware
 *       rather than inline group string checks.
 */
export const handler = async (event: any) => {
    try {
        const boss_instance_id = event.pathParameters?.boss_instance_id;

        if (!boss_instance_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing boss_instance_id path parameter" }),
            };
        }

        // Authorization: Only teachers and admins can resolve a question
        const userRole = event.requestContext?.authorizer?.jwt?.claims?.["cognito:groups"] as string | undefined;
        const userId   = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined;

        if (!userId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized: Missing user identity" }),
            };
        }

        const isTeacher = userRole?.includes("Teachers");
        const isAdmin   = userRole?.includes("Admins");

        if (!isTeacher && !isAdmin) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Only teachers can resolve a question" }),
            };
        }

        // --- 1. Load instance for readiness check ---
        const instance = await getBossBattleInstance(boss_instance_id);

        if (!instance) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Boss battle instance not found" }),
            };
        }

        if (instance.status !== BossBattleStatus.QUESTION_ACTIVE) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "ResolveQuestion can only run during QUESTION_ACTIVE",
                    current_status: instance.status,
                }),
            };
        }

        // --- 1b. Validate resolve readiness (answer-gating) ---
        {
            const isTimed = !!instance.question_ends_at;
            const nowCheck = new Date();
            const timerExpired =
                isTimed && nowCheck >= new Date(instance.question_ends_at!);
            const isReady = instance.ready_to_resolve === true;

            // TODO: For RANDOMIZED_PER_GUILD, per-guild readiness should be checked independently
            // once per-guild question tracking is fully supported.

            if (isTimed) {
                if (!isReady && !timerExpired) {
                    return {
                        statusCode: 409,
                        body: JSON.stringify({
                            error: "Question is still waiting for required answers or timer expiry",
                            ready_to_resolve: false,
                            timer_expired: false,
                        }),
                    };
                }
            } else {
                // Untimed: must wait for all required answers
                if (!isReady) {
                    return {
                        statusCode: 409,
                        body: JSON.stringify({
                            error: "Question cannot be resolved until all required participants have answered",
                            received_answer_count: instance.received_answer_count ?? 0,
                            required_answer_count: instance.required_answer_count ?? 0,
                        }),
                    };
                }
            }
        }

        // --- 2. Delegate to shared core service ---
        let result;
        try {
            result = await resolveQuestionCore(boss_instance_id);
        } catch (err: any) {
            if (err?.name === "ConditionalCheckFailedException") {
                // Another request (auto-resolve or concurrent manual call) already resolved.
                return {
                    statusCode: 409,
                    body: JSON.stringify({
                        error: "Already resolved — battle is no longer in QUESTION_ACTIVE",
                    }),
                };
            }
            throw err;
        }

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error resolving boss battle question:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

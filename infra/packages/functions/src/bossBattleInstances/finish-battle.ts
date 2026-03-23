import { getBossBattleInstance, finishBattle as finishBattleRepo } from "./repo.js";
import { BossBattleStatus } from "./types.js";
import { computeAndWriteBossResults } from "../bossResults/repo.js";

/**
 * Finishable entry states.
 * TODO: extend to QUESTION_ACTIVE if teacher abort from mid-question is needed.
 */
const FINISHABLE_STATUSES = new Set<string>([
    BossBattleStatus.INTERMISSION,
    BossBattleStatus.RESOLVING,
]);

/**
 * POST /boss-battle-instances/{boss_instance_id}/finish
 *
 * FinishBattle finalizes a boss battle, writes BossResults, and transitions
 * the instance to COMPLETED. This is the final orchestration step.
 *
 * It does NOT accept student answers or resolve an active question.
 * Those belong to SubmitBossAnswer and ResolveQuestion.
 *
 * Authorization: TEACHER or ADMIN only.
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

        // Authorization: Only teachers and admins can finish a battle
        const userRole = event.requestContext?.authorizer?.jwt?.claims?.["cognito:groups"] as string | undefined;
        const userId = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined;

        if (!userId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized: Missing user identity" }),
            };
        }

        const isTeacher = userRole?.includes("Teachers");
        const isAdmin = userRole?.includes("Admins");

        if (!isTeacher && !isAdmin) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Only teachers can finish a battle" }),
            };
        }

        // --- 1. Load and validate instance ---
        const instance = await getBossBattleInstance(boss_instance_id);

        if (!instance) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Boss battle instance not found" }),
            };
        }

        if (instance.status === BossBattleStatus.COMPLETED) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "Battle is already COMPLETED" }),
            };
        }

        if (instance.status === BossBattleStatus.ABORTED) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "Battle is ABORTED and cannot be finished" }),
            };
        }

        if (!FINISHABLE_STATUSES.has(instance.status)) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Battle is not in a finishable state",
                    current_status: instance.status,
                    allowed_states: ["INTERMISSION", "RESOLVING"],
                }),
            };
        }

        // --- 2. Determine final outcome ---
        // Outcome is purely threshold-based: WIN if damage dealt >= passing_score.
        // passing_score is set by the teacher when assigning the battle (default 50% of initial HP).
        // Guild/player state does not affect win/fail.
        let outcome: "WIN" | "FAIL";

        const initialHp = instance.initial_boss_hp ?? 0;
        const currentHp = instance.current_boss_hp ?? 0;
        const passingScore = instance.passing_score ?? Math.ceil(initialHp * 0.5);
        const damageDealt = initialHp - currentHp;

        outcome = damageDealt >= passingScore ? "WIN" : "FAIL";

        // --- 3. Conditionally transition instance to COMPLETED ---
        const now = new Date().toISOString();
        let updatedInstance;
        try {
            updatedInstance = await finishBattleRepo(boss_instance_id, {
                outcome,
                completed_at: now,
                updated_at: now,
            });
        } catch (err: any) {
            if (err?.name === "ConditionalCheckFailedException") {
                return {
                    statusCode: 409,
                    body: JSON.stringify({
                        error: "Already finished — battle is no longer in a finishable state",
                    }),
                };
            }
            throw err;
        }

        // --- 4. Write BossResults (instance is now COMPLETED) ---
        const resultsOutcome = await computeAndWriteBossResults(
            boss_instance_id,
            "finish-battle"
        );

        return {
            statusCode: 200,
            body: JSON.stringify({
                boss_instance_id,
                status: updatedInstance.status,
                outcome: updatedInstance.outcome ?? null,
                fail_reason: updatedInstance.fail_reason ?? null,
                completed_at: updatedInstance.completed_at ?? now,
                results_written: resultsOutcome.success,
            }),
        };
    } catch (error: any) {
        console.error("Error finishing boss battle:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

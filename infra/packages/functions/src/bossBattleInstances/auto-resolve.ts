import { getBossBattleInstance } from "./repo.js";
import { BossBattleStatus } from "./types.js";
import { resolveQuestionCore, type ResolveQuestionResult } from "./resolve-question-service.js";
import { tryAutoAdvanceAndStartNextQuestion } from "./auto-advance-question.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutoResolveStatus =
    | "resolved"
    | "already_resolved"
    | "skipped_not_ready"
    | "failed";

export type AutoResolveResult =
    | { auto_resolve_status: "resolved"; result: ResolveQuestionResult }
    | { auto_resolve_status: "already_resolved" }
    | { auto_resolve_status: "skipped_not_ready" }
    | { auto_resolve_status: "failed"; error: string };

export type AutoResolveContext = {
    /** The question that was active when the quorum-triggering answer was submitted. */
    active_question_id: string;
    required_answer_count: number;
    received_answer_count: number;
    /** The student whose answer triggered the quorum — for observability only. */
    student_id: string;
};

// ---------------------------------------------------------------------------
// Auto-resolve helper
// ---------------------------------------------------------------------------

/**
 * tryAutoResolveBossQuestion — attempt to resolve the active boss question
 * immediately after a student submission brings the answer count to quorum.
 *
 * This MUST NOT propagate errors to the SubmitBossAnswer response.
 * If resolution fails for any reason, the submission is already persisted and
 * the teacher's manual ResolveQuestion path remains available as a fallback.
 *
 * Expected race scenario:
 *   Two students submit near-simultaneously as the last required answers.
 *   Both submissions succeed. Both detect quorum and enter this helper.
 *   Only one resolveQuestionCore call will win the DynamoDB conditional write
 *   (status == QUESTION_ACTIVE guard). The other will receive
 *   ConditionalCheckFailedException — handled here as "already_resolved" (not an error).
 *
 * Modes:
 *   SIMULTANEOUS_ALL   — auto-resolve when all joined participants have answered
 *   TURN_BASED_GUILD   — auto-resolve when all active-guild participants have answered
 *   RANDOMIZED_PER_GUILD — TODO: fully support auto-resolve for independent per-guild
 *                          question readiness once RANDOMIZED_PER_GUILD active-question
 *                          tracking is complete
 *
 * TODO: teacher/admin auth is not applicable here (internal trigger);
 *       student identity for audit is provided via context.student_id from JWT sub.
 */
export async function tryAutoResolveBossQuestion(
    boss_instance_id: string,
    context: AutoResolveContext
): Promise<AutoResolveResult> {
    // --- Pre-flight: confirm the instance is still in a resolvable state ---
    // This check avoids triggering expensive aggregation when the race has already
    // been won by another concurrent request or a manual teacher resolve.
    let instance;
    try {
        instance = await getBossBattleInstance(boss_instance_id);
    } catch (err: any) {
        console.error("[AutoResolve] Failed to load instance for pre-flight check", {
            boss_instance_id,
            active_question_id: context.active_question_id,
            student_id: context.student_id,
            error: err.message,
        });
        return { auto_resolve_status: "failed", error: err.message };
    }

    if (
        !instance ||
        instance.status !== BossBattleStatus.QUESTION_ACTIVE ||
        !instance.ready_to_resolve
    ) {
        console.info("[AutoResolve] Skipped — instance not in resolvable state (pre-flight)", {
            boss_instance_id,
            active_question_id: context.active_question_id,
            status: instance?.status ?? "not_found",
            ready_to_resolve: instance?.ready_to_resolve ?? false,
            student_id: context.student_id,
        });
        return { auto_resolve_status: "skipped_not_ready" };
    }

    console.info("[AutoResolve] Quorum reached — attempting auto-resolution", {
        boss_instance_id,
        active_question_id: context.active_question_id,
        required_answer_count: context.required_answer_count,
        received_answer_count: context.received_answer_count,
        student_id: context.student_id,
    });

    try {
        const result = await resolveQuestionCore(boss_instance_id);

        console.info("[AutoResolve] Auto-resolution succeeded", {
            boss_instance_id,
            active_question_id: context.active_question_id,
            new_boss_hp: result.new_boss_hp,
            status: result.status,
            outcome: result.outcome,
            student_id: context.student_id,
        });

        // After resolving to INTERMISSION, immediately advance to the next question
        // so all questions are asked without requiring the teacher monitor to be open.
        if (result.status === "INTERMISSION") {
            await tryAutoAdvanceAndStartNextQuestion(boss_instance_id);
        }

        return { auto_resolve_status: "resolved", result };
    } catch (err: any) {
        // Expected race: another concurrent request (or the teacher's manual call)
        // already resolved this question and moved status away from QUESTION_ACTIVE.
        // The DynamoDB conditional write guard fired — this is safe to ignore.
        if (err?.name === "ConditionalCheckFailedException") {
            console.info(
                "[AutoResolve] Already resolved by concurrent request — race condition handled safely",
                {
                    boss_instance_id,
                    active_question_id: context.active_question_id,
                    student_id: context.student_id,
                }
            );
            return { auto_resolve_status: "already_resolved" };
        }

        // Unexpected failure — log clearly but do NOT fail the originating submit response.
        // The submission is already persisted. The teacher can manually resolve as fallback.
        console.error("[AutoResolve] Unexpected auto-resolution failure", {
            boss_instance_id,
            active_question_id: context.active_question_id,
            student_id: context.student_id,
            error: err.message,
            stack: err.stack,
        });
        return { auto_resolve_status: "failed", error: err.message };
    }
}

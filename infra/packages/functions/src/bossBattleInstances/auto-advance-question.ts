import {
    getBossBattleInstance,
    advanceToNextQuestion,
    startBossBattleQuestion,
    finishBattle,
} from "./repo.js";
import { BossBattleStatus, ModeType } from "./types.js";
import { getQuestionPlan } from "../bossBattleQuestionPlans/repo.js";
import { listParticipants } from "../bossBattleParticipants/repo.js";
import { ParticipantState } from "../bossBattleParticipants/types.js";
import { getQuestion } from "../bossQuestions/repo.js";
import { computeAndWriteBossResults } from "../bossResults/repo.js";
import type { BossBattleQuestionPlanGlobal } from "../bossBattleQuestionPlans/types.js";

/**
 * tryAutoAdvanceAndStartNextQuestion — after a question resolves to INTERMISSION,
 * immediately advance to the next question and start it server-side.
 *
 * This makes the battle self-driving: all questions will be asked without
 * requiring the teacher monitor page to be open between questions.
 *
 * Handles SIMULTANEOUS_ALL and TURN_BASED_GUILD (global question plan).
 * RANDOMIZED_PER_GUILD is skipped (has per-guild plans, handled separately).
 *
 * Race-safe: all DynamoDB writes use conditional guards. If the teacher monitor
 * or another invocation already advanced, ConditionalCheckFailedException is
 * caught and treated as a no-op.
 *
 * MUST NOT propagate errors — submit-answer must always return success.
 */
export async function tryAutoAdvanceAndStartNextQuestion(
    boss_instance_id: string
): Promise<void> {
    try {
        // --- 1. Load instance and confirm it's in INTERMISSION ---
        const instance = await getBossBattleInstance(boss_instance_id);
        if (!instance || instance.status !== BossBattleStatus.INTERMISSION) {
            console.info("[AutoAdvance] Skipped — not in INTERMISSION", {
                boss_instance_id,
                status: instance?.status ?? "not_found",
            });
            return;
        }

        // RANDOMIZED_PER_GUILD uses independent per-guild plans — skip for now
        if (instance.mode_type === ModeType.RANDOMIZED_PER_GUILD) {
            console.info("[AutoAdvance] Skipped — RANDOMIZED_PER_GUILD not supported", {
                boss_instance_id,
            });
            return;
        }

        if (!instance.question_plan_id) {
            console.warn("[AutoAdvance] No question_plan_id on instance", { boss_instance_id });
            return;
        }

        // --- 2. Load the question plan ---
        const plan = (await getQuestionPlan(
            instance.question_plan_id
        )) as BossBattleQuestionPlanGlobal | null;

        if (!plan || !plan.question_ids || plan.question_ids.length === 0) {
            console.warn("[AutoAdvance] Question plan not found or empty", { boss_instance_id });
            return;
        }

        const next_index = (instance.current_question_index ?? 0) + 1;
        const has_more = next_index < plan.question_ids.length;
        const now = new Date().toISOString();

        // --- 3a. No more questions — complete the battle based on passing score ---
        if (!has_more) {
            // total_correct = how many questions the student(s) answered correctly
            // boss HP starts at question count and decreases by 1 per correct answer
            const total_correct = (instance.initial_boss_hp ?? 0) - (instance.current_boss_hp ?? 0);
            const passing_score = (instance as any).passing_score
                ?? Math.ceil((instance.initial_boss_hp ?? 1) / 2);
            const is_passing = total_correct >= passing_score;

            console.info("[AutoAdvance] All questions asked — determining outcome", {
                boss_instance_id,
                total_correct,
                passing_score,
                is_passing,
                questions_asked: plan.question_ids.length,
            });

            try {
                await finishBattle(boss_instance_id, {
                    outcome: is_passing ? "WIN" : "FAIL",
                    fail_reason: is_passing ? undefined : "OUT_OF_QUESTIONS",
                    completed_at: now,
                    updated_at: now,
                });
            } catch (err: any) {
                if (err?.name === "ConditionalCheckFailedException") {
                    console.info("[AutoAdvance] Already finished by concurrent call — skipping", {
                        boss_instance_id,
                    });
                    return;
                }
                throw err;
            }

            // Compute BossResults so the student's result screen has data
            await computeAndWriteBossResults(boss_instance_id, "auto-advance").catch((err) => {
                console.warn("[AutoAdvance] computeAndWriteBossResults failed (non-fatal):", {
                    boss_instance_id,
                    error: err?.message,
                });
            });

            return;
        }

        // --- 3b. More questions remain — advance index, then start next question ---
        console.info("[AutoAdvance] Advancing to next question", {
            boss_instance_id,
            next_index,
            total_questions: plan.question_ids.length,
        });

        try {
            await advanceToNextQuestion(boss_instance_id, {
                next_question_index: next_index,
                next_status: "INTERMISSION",
                updated_at: now,
            });
        } catch (err: any) {
            if (err?.name === "ConditionalCheckFailedException") {
                console.info("[AutoAdvance] Already advanced by concurrent call — skipping", {
                    boss_instance_id,
                });
                return;
            }
            throw err;
        }

        // --- 4. Load next question for timing ---
        const next_question_id = plan.question_ids[next_index];
        const question = await getQuestion(next_question_id);
        if (!question) {
            console.warn("[AutoAdvance] Next question not found", {
                boss_instance_id,
                next_question_id,
            });
            return;
        }

        // --- 5. Compute quorum for next question ---
        const allJoined = await listParticipants(boss_instance_id, {
            state: ParticipantState.JOINED,
        });
        const activeParticipants = allJoined.filter((p) => !p.is_downed);
        const required_answer_count = activeParticipants.length;

        // --- 6. Compute question timing ---
        const effectiveTimeLimit =
            question.time_limit_seconds ?? instance.time_limit_seconds_default ?? null;
        const question_ends_at =
            effectiveTimeLimit !== null
                ? new Date(Date.now() + effectiveTimeLimit * 1000).toISOString()
                : null;

        // --- 7. Start next question (INTERMISSION → QUESTION_ACTIVE) ---
        try {
            await startBossBattleQuestion(boss_instance_id, {
                active_question_id: next_question_id,
                active_guild_id:
                    instance.mode_type === ModeType.TURN_BASED_GUILD
                        ? instance.active_guild_id
                        : undefined,
                question_started_at: now,
                question_ends_at,
                updated_at: now,
                required_answer_count,
                received_answer_count: 0,
                ready_to_resolve: required_answer_count === 0,
            });
        } catch (err: any) {
            if (err?.name === "ConditionalCheckFailedException") {
                console.info("[AutoAdvance] startBossBattleQuestion race — already started", {
                    boss_instance_id,
                });
                return;
            }
            throw err;
        }

        console.info("[AutoAdvance] Next question started successfully", {
            boss_instance_id,
            next_question_id,
            next_index,
        });
    } catch (err: any) {
        // Must not propagate — submit-answer must still return success
        console.error("[AutoAdvance] Unexpected failure (non-fatal)", {
            boss_instance_id,
            error: err.message,
            stack: err.stack,
        });
    }
}

import { getBossBattleInstance, incrementAnswerCount, setReadyToResolve } from "./repo.js";
import { BossBattleStatus, ModeType } from "./types.js";
import { getQuestion } from "../bossQuestions/repo.js";
import { getParticipant, updateAntiSpamFields } from "../bossBattleParticipants/repo.js";
import { ParticipantState } from "../bossBattleParticipants/types.js";
import {
    createBossAnswerAttempt,
    getStudentAttemptForQuestion,
} from "../bossAnswerAttempts/repo.js";
import type { BossQuestionItem } from "../bossQuestions/types.js";
import { tryAutoResolveBossQuestion } from "./auto-resolve.js";

/**
 * POST /boss-battle-instances/{boss_instance_id}/submit-answer
 *
 * SubmitBossAnswer — validates and logs a student answer during QUESTION_ACTIVE.
 * Final HP/reward application happens in ResolveQuestion.
 *
 * Authorization: Students group only. student_id is derived from the JWT sub claim.
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

        // Authorization: Only students can submit answers; student_id comes from JWT
        const userRole = event.requestContext?.authorizer?.jwt?.claims?.["cognito:groups"] as string | undefined;
        const student_id = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined;

        if (!student_id) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized: Missing user identity" }),
            };
        }

        const isStudent = userRole?.includes("Students");

        if (!isStudent) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Only students can submit answers" }),
            };
        }

        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const { answer_raw } = body;

        if (!answer_raw || typeof answer_raw !== "object" || Array.isArray(answer_raw)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "answer_raw must be an object" }),
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

        if (instance.status !== BossBattleStatus.QUESTION_ACTIVE) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Answers can only be submitted during QUESTION_ACTIVE",
                    current_status: instance.status,
                }),
            };
        }

        if (!instance.active_question_id) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "No active question on this battle instance" }),
            };
        }

        // --- 2. Load question ---
        const question = await getQuestion(instance.active_question_id);

        if (!question) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Active boss question not found" }),
            };
        }

        if (!question.auto_gradable) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "Question is not auto-gradable" }),
            };
        }

        // --- 3. Load and validate participant ---
        const participant = await getParticipant(boss_instance_id, student_id);

        if (!participant) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Participant not found for this battle" }),
            };
        }

        if (participant.state !== ParticipantState.JOINED) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Only JOINED participants may submit answers",
                    state: participant.state,
                }),
            };
        }

        const now = new Date();
        const nowMs = now.getTime();
        const nowIso = now.toISOString();

        // Check frozen_until
        if (participant.frozen_until && new Date(participant.frozen_until).getTime() > nowMs) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Participant is frozen and cannot submit yet",
                    frozen_until: participant.frozen_until,
                }),
            };
        }

        // Check anti-spam interval
        if (participant.last_submit_at) {
            const msSinceLast = nowMs - new Date(participant.last_submit_at).getTime();
            if (msSinceLast < (instance.anti_spam_min_submit_interval_ms ?? 0)) {
                return {
                    statusCode: 409,
                    body: JSON.stringify({ error: "Submission too soon — anti-spam cooldown active" }),
                };
            }
        }

        // --- 4. Reject duplicate submission ---
        const existing = await getStudentAttemptForQuestion(
            boss_instance_id,
            instance.active_question_id,
            student_id
        );

        if (existing) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Duplicate submission — already answered this question",
                }),
            };
        }

        // --- 5. Mode-specific validation ---
        if (instance.mode_type === ModeType.TURN_BASED_GUILD) {
            if (
                instance.active_guild_id &&
                participant.guild_id !== instance.active_guild_id
            ) {
                return {
                    statusCode: 409,
                    body: JSON.stringify({
                        error: "Only the active guild may submit during TURN_BASED_GUILD",
                        active_guild_id: instance.active_guild_id,
                        participant_guild_id: participant.guild_id,
                    }),
                };
            }
            // TODO: enforce single-student-per-guild-turn if required by game design
        }

        if (instance.mode_type === ModeType.RANDOMIZED_PER_GUILD) {
            // TODO: RANDOMIZED_PER_GUILD should validate the guild-specific active question
            // rather than a single global active_question_id
        }

        // Check late submission (timed questions)
        if (instance.question_ends_at) {
            const endsAt = new Date(instance.question_ends_at).getTime();
            if (nowMs > endsAt) {
                return {
                    statusCode: 409,
                    body: JSON.stringify({ error: "Submission is too late — question time has expired" }),
                };
            }
        }

        // --- 6. Grade answer ---
        const is_correct = gradeAnswer(question, answer_raw);

        // --- 7. Compute timing & speed multiplier ---
        const questionStartedAt = instance.question_started_at
            ? new Date(instance.question_started_at).getTime()
            : nowMs;
        const elapsed_seconds = Math.max(0, (nowMs - questionStartedAt) / 1000);

        const effectiveTimeLimit: number | null =
            question.time_limit_seconds ?? instance.time_limit_seconds_default ?? null;

        let speed_multiplier: number;
        if (!instance.speed_bonus_enabled) {
            speed_multiplier = 1;
        } else {
            const floor = instance.speed_bonus_floor_multiplier ?? 0;
            const window = effectiveTimeLimit ?? instance.speed_window_seconds ?? 30;
            const raw = 1 - elapsed_seconds / window;
            speed_multiplier = Math.min(1, Math.max(floor, raw));
        }

        // --- 8. Compute per-attempt effects ---
        let damage_to_boss = 0;
        let hearts_delta_student = 0;
        const hearts_delta_guild_total = 0;

        if (is_correct) {
            damage_to_boss = 1; // Fixed: 1 damage per correct answer; boss HP equals question count
        } else {
            hearts_delta_student = -1; // All modes: individual heart loss
        }

        const xp_earned = is_correct ? (question.xp_reward ?? 0) : 0;

        // --- 9. Write attempt ---
        const attempt = await createBossAnswerAttempt({
            boss_instance_id,
            class_id: instance.class_id,
            question_id: instance.active_question_id,
            student_id,
            guild_id: participant.guild_id,
            answer_raw,
            is_correct,
            elapsed_seconds,
            effective_time_limit_seconds: effectiveTimeLimit ?? undefined,
            speed_multiplier,
            damage_to_boss,
            hearts_delta_student,
            hearts_delta_guild_total,
            xp_earned,
            mode_type: instance.mode_type as any,
            status_at_submit: "QUESTION_ACTIVE",
        });

        // --- 10. Update participant anti-spam fields ---
        let frozen_until: string | undefined;
        if (!is_correct && (instance.freeze_on_wrong_seconds ?? 0) > 0) {
            frozen_until = new Date(
                nowMs + (instance.freeze_on_wrong_seconds! * 1000)
            ).toISOString();
        }

        await updateAntiSpamFields(boss_instance_id, student_id, {
            last_submit_at: nowIso,
            frozen_until,
        });

        // --- 11. Update answer-gating quorum counters ---
        const updatedInstance = await incrementAnswerCount(boss_instance_id, {
            mode: instance.mode_type,
            guild_id: participant.guild_id,
        });

        let ready_to_resolve = updatedInstance.ready_to_resolve ?? false;

        if (!ready_to_resolve) {
            if (instance.mode_type === ModeType.RANDOMIZED_PER_GUILD) {
                // TODO: RANDOMIZED_PER_GUILD submission quorum should be resolved against guild-specific active question state
                const guildRequired =
                    updatedInstance.per_guild_required_answer_count?.[participant.guild_id] ?? 0;
                const guildReceived =
                    updatedInstance.per_guild_received_answer_count?.[participant.guild_id] ?? 0;
                if (guildRequired > 0 && guildReceived >= guildRequired) {
                    await setReadyToResolve(boss_instance_id, { guild_id: participant.guild_id });
                    ready_to_resolve = true;
                }
            } else {
                // SIMULTANEOUS_ALL and TURN_BASED_GUILD: use global counters
                const newReceived = updatedInstance.received_answer_count ?? 0;
                const required = updatedInstance.required_answer_count ?? 0;
                if (required > 0 && newReceived >= required) {
                    await setReadyToResolve(boss_instance_id, {});
                    ready_to_resolve = true;
                }
            }
        }

        // Optional auto-resolve path: when all required answers are received, attempt to resolve immediately.
        // Safe because ResolveQuestion is idempotent.
        //
        // Expected race scenario: two students submit the last required answers near-simultaneously.
        // Both may detect quorum (ready_to_resolve = true) and both enter this path.
        // Only one resolveQuestionCore call will win the DynamoDB conditional write (status == QUESTION_ACTIVE guard).
        // The other receives ConditionalCheckFailedException → auto_resolve_status = "already_resolved" → not an error.
        let auto_resolve_status: "not_needed" | "resolved" | "already_resolved" | "failed" = "not_needed";

        if (ready_to_resolve) {
            // TODO: RANDOMIZED_PER_GUILD auto-resolve should be triggered per-guild once per-guild
            // active-question tracking is complete. Currently uses the shared readiness path.
            const autoResult = await tryAutoResolveBossQuestion(boss_instance_id, {
                active_question_id: instance.active_question_id,
                required_answer_count: updatedInstance.required_answer_count ?? 0,
                received_answer_count: updatedInstance.received_answer_count ?? 0,
                student_id,
            });
            auto_resolve_status =
                autoResult.auto_resolve_status === "skipped_not_ready"
                    ? "not_needed"
                    : autoResult.auto_resolve_status;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                is_correct,
                answered_at: attempt.answered_at,
                elapsed_seconds,
                effective_time_limit_seconds: effectiveTimeLimit ?? null,
                speed_multiplier,
                damage_to_boss,
                hearts_delta_student,
                hearts_delta_guild_total,
                xp_earned,
                frozen_until: frozen_until ?? null,
                received_answer_count: updatedInstance.received_answer_count ?? 0,
                required_answer_count: updatedInstance.required_answer_count ?? 0,
                ready_to_resolve,
                quorum_reached: ready_to_resolve,
                auto_resolve_attempted: ready_to_resolve,
                auto_resolve_succeeded: auto_resolve_status === "resolved",
                auto_resolve_status,
            }),
        };
    } catch (error: any) {
        console.error("Error submitting boss battle answer:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

// ---------------------------------------------------------------------------
// Auto-grading
// ---------------------------------------------------------------------------

/**
 * Auto-grade a student's answer against the stored correct answer.
 * Only handles auto_gradable question types.
 */
function gradeAnswer(question: BossQuestionItem, answer_raw: Record<string, any>): boolean {
    const { question_type, correct_answer } = question;

    if (correct_answer === undefined || correct_answer === null) return false;

    const submitted = answer_raw.value;

    switch (question_type) {
        case "MCQ_SINGLE": {
            // correct_answer may be stored as { index: n } (legacy) or as the option text/value
            let expected: string;
            if (correct_answer !== null && typeof correct_answer === "object" && "index" in correct_answer) {
                // Resolve the option text at the stored index
                const idx = Number((correct_answer as any).index);
                const opts: any[] = Array.isArray(question.options) ? question.options : [];
                const opt = opts[idx];
                if (opt === undefined) return false;
                expected = String(typeof opt === "object" ? (opt.text ?? opt.value ?? opt.label ?? opt) : opt).trim();
            } else {
                expected = String(correct_answer).trim();
            }
            return String(submitted ?? "").trim() === expected;
        }
        case "TRUE_FALSE":
            // correct_answer is stored as boolean true/false; submitted is "true"/"false" (lowercase)
            return String(submitted ?? "").trim().toLowerCase() === String(correct_answer).toLowerCase();

        case "MCQ_MULTI": {
            if (!Array.isArray(submitted) || !Array.isArray(correct_answer)) return false;
            const a = [...submitted].map(String).sort();
            const b = [...correct_answer].map(String).sort();
            return JSON.stringify(a) === JSON.stringify(b);
        }

        case "SHORT_ANSWER":
            return (
                String(submitted ?? "").trim().toLowerCase() ===
                String(correct_answer).trim().toLowerCase()
            );

        case "NUMERIC":
            return Number(submitted) === Number(correct_answer);

        default:
            return false;
    }
}

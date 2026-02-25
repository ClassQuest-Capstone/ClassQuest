/**
 * Integration Example: Boss Battle Answer Submission Handler
 *
 * This is a STUB/EXAMPLE showing how the boss battle submission handler
 * should integrate with BossAnswerAttempts.
 *
 * The actual submission handler should be implemented in a separate module
 * (e.g., bossBattleSubmissions/submit-answer.ts).
 */

import { createBossAnswerAttempt } from "./repo.js";
import { validateCreateAttemptInput } from "./validation.js";

/**
 * Example: Process boss battle answer submission
 *
 * This function would be called by the boss battle submit handler after:
 * 1. Validating the submission
 * 2. Checking anti-spam fields in BossBattleParticipants
 * 3. Auto-grading the answer using BossQuestions
 * 4. Computing speed multiplier, damage, and hearts deltas
 */
export async function exampleSubmitBossAnswer(params: {
    boss_instance_id: string;
    class_id: string;
    question_id: string;
    student_id: string;
    guild_id: string;
    answer_raw: Record<string, any>;
    question_started_at: string; // ISO timestamp when question became active
    speed_bonus_enabled: boolean;
    speed_bonus_floor_multiplier: number;
    speed_window_seconds: number;
    effective_time_limit_seconds?: number; // From BossQuestions
    base_damage: number; // From BossQuestions
    mode_type: "SIMULTANEOUS_ALL" | "TURN_BASED_GUILD" | "RANDOMIZED_PER_GUILD";
    status_at_submit: string;
}) {
    // Step 1: Auto-grade the answer (using BossQuestions)
    // TODO: Implement auto-grading logic
    const is_correct = true; // Placeholder
    const auto_grade_result = { score: 100 }; // Placeholder

    // Step 2: Compute elapsed time
    const now = new Date();
    const started = new Date(params.question_started_at);
    const elapsed_seconds = (now.getTime() - started.getTime()) / 1000;

    // Step 3: Compute speed multiplier (if enabled)
    let speed_multiplier: number | undefined;
    if (params.speed_bonus_enabled) {
        const timeLimit = params.effective_time_limit_seconds || params.speed_window_seconds;
        const rawMultiplier = 1 - elapsed_seconds / timeLimit;
        speed_multiplier = Math.max(params.speed_bonus_floor_multiplier, rawMultiplier);
    }

    // Step 4: Compute damage to boss
    let damage_to_boss = 0;
    if (is_correct) {
        damage_to_boss = params.base_damage;
        if (speed_multiplier !== undefined) {
            damage_to_boss = Math.round(params.base_damage * speed_multiplier);
        }
    }

    // Step 5: Compute hearts deltas
    let hearts_delta_student = 0;
    let hearts_delta_guild_total = 0;
    if (!is_correct) {
        // Wrong answer penalty
        hearts_delta_student = -1; // Example: lose 1 heart
        if (params.mode_type === "TURN_BASED_GUILD") {
            hearts_delta_guild_total = -3; // Example: entire guild loses hearts
        }
    }

    // Step 6: Validate input before logging
    const attemptInput = {
        boss_instance_id: params.boss_instance_id,
        class_id: params.class_id,
        question_id: params.question_id,
        student_id: params.student_id,
        guild_id: params.guild_id,
        answer_raw: params.answer_raw,
        is_correct,
        elapsed_seconds,
        effective_time_limit_seconds: params.effective_time_limit_seconds,
        speed_multiplier,
        damage_to_boss,
        hearts_delta_student,
        hearts_delta_guild_total,
        mode_type: params.mode_type as any,
        status_at_submit: params.status_at_submit as any,
        auto_grade_result,
    };

    const validation = validateCreateAttemptInput(attemptInput);
    if (!validation.valid) {
        throw new Error(`Invalid attempt input: ${validation.error}`);
    }

    // Step 7: Log the attempt (append-only combat log)
    const attempt = await createBossAnswerAttempt(attemptInput);

    // Step 8: Update BossBattleInstances.current_boss_hp
    // TODO: Implement HP update logic

    // Step 9: Update BossBattleParticipants anti-spam fields
    // TODO: Update last_submit_at, frozen_until if wrong

    // Step 10: Optionally create RewardTransactions entry
    // TODO: If per-question rewards are enabled

    return {
        attempt_id: attempt.attempt_sk,
        is_correct,
        damage_to_boss,
        speed_multiplier,
        elapsed_seconds,
        hearts_delta_student,
        hearts_delta_guild_total,
    };
}

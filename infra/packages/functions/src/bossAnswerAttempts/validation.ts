/**
 * Validation functions for BossAnswerAttempts
 */

import { CreateBossAnswerAttemptInput, ModeType, BattleStatus } from "./types.js";

export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

/**
 * Validate required string field
 */
export function validateRequiredString(value: any, fieldName: string): ValidationResult {
    if (typeof value !== "string" || value.trim().length === 0) {
        return {
            valid: false,
            error: `${fieldName} is required and must be a non-empty string`,
        };
    }
    return { valid: true };
}

/**
 * Validate elapsed_seconds (must be >= 0)
 */
export function validateElapsedSeconds(elapsed: any): ValidationResult {
    if (typeof elapsed !== "number" || elapsed < 0) {
        return {
            valid: false,
            error: "elapsed_seconds must be a non-negative number",
        };
    }
    return { valid: true };
}

/**
 * Validate effective_time_limit_seconds (if provided, must be >= 1)
 */
export function validateEffectiveTimeLimit(limit: any): ValidationResult {
    if (limit === undefined || limit === null) {
        return { valid: true }; // Optional field
    }

    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1) {
        return {
            valid: false,
            error: "effective_time_limit_seconds must be an integer >= 1",
        };
    }

    return { valid: true };
}

/**
 * Validate speed_multiplier (if provided, must be 0..1)
 */
export function validateSpeedMultiplier(multiplier: any): ValidationResult {
    if (multiplier === undefined || multiplier === null) {
        return { valid: true }; // Optional field
    }

    if (typeof multiplier !== "number" || multiplier < 0 || multiplier > 1) {
        return {
            valid: false,
            error: "speed_multiplier must be a number between 0 and 1",
        };
    }

    return { valid: true };
}

/**
 * Validate damage_to_boss (must be >= 0)
 */
export function validateDamageToBoss(damage: any): ValidationResult {
    if (typeof damage !== "number" || damage < 0) {
        return {
            valid: false,
            error: "damage_to_boss must be a non-negative number",
        };
    }
    return { valid: true };
}

/**
 * Validate hearts delta (must be <= 0)
 */
export function validateHeartsDelta(delta: any, fieldName: string): ValidationResult {
    if (typeof delta !== "number" || delta > 0) {
        return {
            valid: false,
            error: `${fieldName} must be a non-positive number (0 or negative)`,
        };
    }
    return { valid: true };
}

/**
 * Validate mode_type enum
 */
export function validateModeType(mode: any): ValidationResult {
    const validModes: ModeType[] = [
        "SIMULTANEOUS_ALL",
        "TURN_BASED_GUILD",
        "RANDOMIZED_PER_GUILD",
    ];

    if (!validModes.includes(mode)) {
        return {
            valid: false,
            error: `mode_type must be one of: ${validModes.join(", ")}`,
        };
    }

    return { valid: true };
}

/**
 * Validate status_at_submit enum
 */
export function validateStatusAtSubmit(status: any): ValidationResult {
    const validStatuses: BattleStatus[] = [
        "DRAFT",
        "LOBBY",
        "COUNTDOWN",
        "QUESTION_ACTIVE",
        "RESOLVING",
        "INTERMISSION",
        "COMPLETED",
        "ABORTED",
    ];

    if (!validStatuses.includes(status)) {
        return {
            valid: false,
            error: `status_at_submit must be one of: ${validStatuses.join(", ")}`,
        };
    }

    return { valid: true };
}

/**
 * Validate answer_raw (must be an object/map)
 */
export function validateAnswerRaw(answer: any): ValidationResult {
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
        return {
            valid: false,
            error: "answer_raw must be an object/map",
        };
    }
    return { valid: true };
}

/**
 * Validate create attempt input
 */
export function validateCreateAttemptInput(
    input: CreateBossAnswerAttemptInput
): ValidationResult {
    // Validate required strings
    const stringFields = [
        "boss_instance_id",
        "class_id",
        "question_id",
        "student_id",
        "guild_id",
    ] as const;

    for (const field of stringFields) {
        const result = validateRequiredString(input[field], field);
        if (!result.valid) {
            return result;
        }
    }

    // Validate answer_raw
    const answerResult = validateAnswerRaw(input.answer_raw);
    if (!answerResult.valid) {
        return answerResult;
    }

    // Validate is_correct is boolean
    if (typeof input.is_correct !== "boolean") {
        return {
            valid: false,
            error: "is_correct must be a boolean",
        };
    }

    // Validate elapsed_seconds
    const elapsedResult = validateElapsedSeconds(input.elapsed_seconds);
    if (!elapsedResult.valid) {
        return elapsedResult;
    }

    // Validate optional effective_time_limit_seconds
    const timeLimitResult = validateEffectiveTimeLimit(
        input.effective_time_limit_seconds
    );
    if (!timeLimitResult.valid) {
        return timeLimitResult;
    }

    // Validate optional speed_multiplier
    const speedResult = validateSpeedMultiplier(input.speed_multiplier);
    if (!speedResult.valid) {
        return speedResult;
    }

    // Validate damage_to_boss
    const damageResult = validateDamageToBoss(input.damage_to_boss);
    if (!damageResult.valid) {
        return damageResult;
    }

    // Validate hearts_delta_student
    const studentDeltaResult = validateHeartsDelta(
        input.hearts_delta_student,
        "hearts_delta_student"
    );
    if (!studentDeltaResult.valid) {
        return studentDeltaResult;
    }

    // Validate hearts_delta_guild_total
    const guildDeltaResult = validateHeartsDelta(
        input.hearts_delta_guild_total,
        "hearts_delta_guild_total"
    );
    if (!guildDeltaResult.valid) {
        return guildDeltaResult;
    }

    // Validate mode_type
    const modeResult = validateModeType(input.mode_type);
    if (!modeResult.valid) {
        return modeResult;
    }

    // Validate status_at_submit
    const statusResult = validateStatusAtSubmit(input.status_at_submit);
    if (!statusResult.valid) {
        return statusResult;
    }

    return { valid: true };
}

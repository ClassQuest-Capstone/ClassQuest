import {
    BossBattleStatus,
    ModeType,
    QuestionSelectionMode,
    LateJoinPolicy,
    TurnPolicy,
    BattleOutcome,
    FailReason,
} from "./types.js";

export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

/**
 * Validate BossBattleStatus enum
 */
export function validateStatus(status: string): ValidationResult {
    const validStatuses = Object.values(BossBattleStatus);
    if (!validStatuses.includes(status as BossBattleStatus)) {
        return {
            valid: false,
            error: `status must be one of: ${validStatuses.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate ModeType enum
 */
export function validateModeType(mode_type: string): ValidationResult {
    const validModes = Object.values(ModeType);
    if (!validModes.includes(mode_type as ModeType)) {
        return {
            valid: false,
            error: `mode_type must be one of: ${validModes.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate QuestionSelectionMode enum
 */
export function validateQuestionSelectionMode(mode: string): ValidationResult {
    const validModes = Object.values(QuestionSelectionMode);
    if (!validModes.includes(mode as QuestionSelectionMode)) {
        return {
            valid: false,
            error: `question_selection_mode must be one of: ${validModes.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate LateJoinPolicy enum
 */
export function validateLateJoinPolicy(policy: string): ValidationResult {
    const validPolicies = Object.values(LateJoinPolicy);
    if (!validPolicies.includes(policy as LateJoinPolicy)) {
        return {
            valid: false,
            error: `late_join_policy must be one of: ${validPolicies.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate TurnPolicy enum
 */
export function validateTurnPolicy(policy: string): ValidationResult {
    const validPolicies = Object.values(TurnPolicy);
    if (!validPolicies.includes(policy as TurnPolicy)) {
        return {
            valid: false,
            error: `turn_policy must be one of: ${validPolicies.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate BattleOutcome enum
 */
export function validateOutcome(outcome: string): ValidationResult {
    const validOutcomes = Object.values(BattleOutcome);
    if (!validOutcomes.includes(outcome as BattleOutcome)) {
        return {
            valid: false,
            error: `outcome must be one of: ${validOutcomes.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate FailReason enum
 */
export function validateFailReason(reason: string): ValidationResult {
    const validReasons = Object.values(FailReason);
    if (!validReasons.includes(reason as FailReason)) {
        return {
            valid: false,
            error: `fail_reason must be one of: ${validReasons.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate HP values
 */
export function validateHP(hp: number, fieldName: string): ValidationResult {
    if (typeof hp !== "number" || !Number.isInteger(hp) || hp < 1) {
        return {
            valid: false,
            error: `${fieldName} must be a positive integer >= 1`,
        };
    }
    return { valid: true };
}

/**
 * Validate floor multiplier (0..1 range)
 */
export function validateFloorMultiplier(multiplier: number): ValidationResult {
    if (typeof multiplier !== "number" || multiplier < 0 || multiplier > 1) {
        return {
            valid: false,
            error: "speed_bonus_floor_multiplier must be a number between 0 and 1",
        };
    }
    return { valid: true };
}

/**
 * Validate question index (>= 0)
 */
export function validateQuestionIndex(index: number): ValidationResult {
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0) {
        return {
            valid: false,
            error: "current_question_index must be a non-negative integer",
        };
    }
    return { valid: true };
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(value: number, fieldName: string): ValidationResult {
    if (typeof value !== "number" || value < 0) {
        return {
            valid: false,
            error: `${fieldName} must be a non-negative number`,
        };
    }
    return { valid: true };
}

/**
 * Validate ISO timestamp string
 */
export function validateISOTimestamp(timestamp: string): ValidationResult {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    if (!isoRegex.test(timestamp)) {
        return {
            valid: false,
            error: "Timestamp must be a valid ISO 8601 string",
        };
    }
    return { valid: true };
}

/**
 * Validate create battle instance input
 */
export function validateCreateBattleInput(input: {
    class_id?: string;
    boss_template_id?: string;
    created_by_teacher_id?: string;
    initial_boss_hp?: number;
    mode_type?: string;
    question_selection_mode?: string;
    speed_bonus_floor_multiplier?: number;
    late_join_policy?: string;
    turn_policy?: string;
    speed_window_seconds?: number;
    anti_spam_min_submit_interval_ms?: number;
    freeze_on_wrong_seconds?: number;
}): ValidationResult {
    // Validate required fields
    if (!input.class_id || typeof input.class_id !== "string") {
        return { valid: false, error: "class_id is required" };
    }

    if (!input.boss_template_id || typeof input.boss_template_id !== "string") {
        return { valid: false, error: "boss_template_id is required" };
    }

    if (!input.created_by_teacher_id || typeof input.created_by_teacher_id !== "string") {
        return { valid: false, error: "created_by_teacher_id is required" };
    }

    if (input.initial_boss_hp === undefined) {
        return { valid: false, error: "initial_boss_hp is required" };
    }

    const hpValidation = validateHP(input.initial_boss_hp, "initial_boss_hp");
    if (!hpValidation.valid) return hpValidation;

    // Validate optional enums
    if (input.mode_type !== undefined) {
        const modeValidation = validateModeType(input.mode_type);
        if (!modeValidation.valid) return modeValidation;
    }

    if (input.question_selection_mode !== undefined) {
        const qsmValidation = validateQuestionSelectionMode(input.question_selection_mode);
        if (!qsmValidation.valid) return qsmValidation;
    }

    if (input.late_join_policy !== undefined) {
        const ljpValidation = validateLateJoinPolicy(input.late_join_policy);
        if (!ljpValidation.valid) return ljpValidation;
    }

    if (input.turn_policy !== undefined) {
        const tpValidation = validateTurnPolicy(input.turn_policy);
        if (!tpValidation.valid) return tpValidation;
    }

    // Validate floor multiplier if provided
    if (input.speed_bonus_floor_multiplier !== undefined) {
        const floorValidation = validateFloorMultiplier(input.speed_bonus_floor_multiplier);
        if (!floorValidation.valid) return floorValidation;
    }

    // Validate positive numbers if provided
    if (input.speed_window_seconds !== undefined) {
        const validation = validatePositiveNumber(input.speed_window_seconds, "speed_window_seconds");
        if (!validation.valid) return validation;
    }

    if (input.anti_spam_min_submit_interval_ms !== undefined) {
        const validation = validatePositiveNumber(input.anti_spam_min_submit_interval_ms, "anti_spam_min_submit_interval_ms");
        if (!validation.valid) return validation;
    }

    if (input.freeze_on_wrong_seconds !== undefined) {
        const validation = validatePositiveNumber(input.freeze_on_wrong_seconds, "freeze_on_wrong_seconds");
        if (!validation.valid) return validation;
    }

    return { valid: true };
}

/**
 * Validate update battle instance input
 */
export function validateUpdateBattleInput(input: {
    status?: string;
    current_boss_hp?: number;
    current_question_index?: number;
    outcome?: string;
    fail_reason?: string;
    lobby_opened_at?: string;
    countdown_end_at?: string;
    question_started_at?: string;
    question_ends_at?: string;
    intermission_ends_at?: string;
    completed_at?: string;
}): ValidationResult {
    // Validate status if provided
    if (input.status !== undefined) {
        const statusValidation = validateStatus(input.status);
        if (!statusValidation.valid) return statusValidation;
    }

    // Validate HP if provided
    if (input.current_boss_hp !== undefined) {
        // Allow 0 for current_boss_hp (boss defeated)
        if (typeof input.current_boss_hp !== "number" || !Number.isInteger(input.current_boss_hp) || input.current_boss_hp < 0) {
            return {
                valid: false,
                error: "current_boss_hp must be a non-negative integer",
            };
        }
    }

    // Validate question index if provided
    if (input.current_question_index !== undefined) {
        const indexValidation = validateQuestionIndex(input.current_question_index);
        if (!indexValidation.valid) return indexValidation;
    }

    // Validate outcome if provided
    if (input.outcome !== undefined) {
        const outcomeValidation = validateOutcome(input.outcome);
        if (!outcomeValidation.valid) return outcomeValidation;
    }

    // Validate fail reason if provided
    if (input.fail_reason !== undefined) {
        const failReasonValidation = validateFailReason(input.fail_reason);
        if (!failReasonValidation.valid) return failReasonValidation;
    }

    // Validate timestamps if provided
    const timestampFields = [
        "lobby_opened_at",
        "countdown_end_at",
        "question_started_at",
        "question_ends_at",
        "intermission_ends_at",
        "completed_at",
    ];

    for (const field of timestampFields) {
        if (input[field as keyof typeof input] !== undefined) {
            const validation = validateISOTimestamp(input[field as keyof typeof input] as string);
            if (!validation.valid) {
                return { valid: false, error: `${field}: ${validation.error}` };
            }
        }
    }

    return { valid: true };
}

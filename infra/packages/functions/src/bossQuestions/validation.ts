import type { BossQuestionType } from "./types.ts";

const VALID_QUESTION_TYPES: BossQuestionType[] = [
    "MCQ_SINGLE",
    "MCQ_MULTI",
    "TRUE_FALSE",
    "SHORT_ANSWER",
    "NUMERIC",
    "OTHER",
];

export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

/**
 * Validate time_limit_seconds
 */
export function validateTimeLimit(time_limit_seconds: number): ValidationResult {
    if (!Number.isInteger(time_limit_seconds) || time_limit_seconds <= 0) {
        return {
            valid: false,
            error: "time_limit_seconds must be a positive integer",
        };
    }
    return { valid: true };
}

/**
 * Validate boss question creation/update input
 */
export function validateQuestion(input: {
    order_index?: number;
    question_text?: string;
    question_type?: string;
    damage_to_boss_on_correct?: number;
    damage_to_guild_on_incorrect?: number;
    auto_gradable?: boolean;
    correct_answer?: any;
    max_points?: number;
    time_limit_seconds?: number;
}): ValidationResult {
    // Validate order_index
    if (input.order_index !== undefined) {
        if (!Number.isInteger(input.order_index) || input.order_index < 0) {
            return {
                valid: false,
                error: "order_index must be a non-negative integer",
            };
        }
    }

    // Validate question_text
    if (input.question_text !== undefined) {
        if (typeof input.question_text !== "string" || input.question_text.trim().length === 0) {
            return {
                valid: false,
                error: "question_text must be a non-empty string",
            };
        }
    }

    // Validate question_type
    if (input.question_type !== undefined) {
        if (!VALID_QUESTION_TYPES.includes(input.question_type as BossQuestionType)) {
            return {
                valid: false,
                error: `question_type must be one of: ${VALID_QUESTION_TYPES.join(", ")}`,
            };
        }
    }

    // Validate damage fields
    if (input.damage_to_boss_on_correct !== undefined) {
        if (
            typeof input.damage_to_boss_on_correct !== "number" ||
            input.damage_to_boss_on_correct < 0
        ) {
            return {
                valid: false,
                error: "damage_to_boss_on_correct must be a non-negative number",
            };
        }
    }

    if (input.damage_to_guild_on_incorrect !== undefined) {
        if (
            typeof input.damage_to_guild_on_incorrect !== "number" ||
            input.damage_to_guild_on_incorrect < 0
        ) {
            return {
                valid: false,
                error: "damage_to_guild_on_incorrect must be a non-negative number",
            };
        }
    }

    // Validate max_points
    if (input.max_points !== undefined) {
        if (typeof input.max_points !== "number" || input.max_points < 0) {
            return {
                valid: false,
                error: "max_points must be a non-negative number",
            };
        }
    }

    // Validate auto_gradable logic
    if (input.auto_gradable === true && input.correct_answer === undefined) {
        return {
            valid: false,
            error: "correct_answer must be provided when auto_gradable is true",
        };
    }

    // Validate time_limit_seconds if provided
    if (input.time_limit_seconds !== undefined) {
        const timeLimitValidation = validateTimeLimit(input.time_limit_seconds);
        if (!timeLimitValidation.valid) {
            return timeLimitValidation;
        }
    }

    return { valid: true };
}

/**
 * Validation functions for BossBattleQuestionPlans
 */

import { ModeType, QuestionSelectionMode } from "./types.js";

export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

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
 * Validate question_selection_mode enum
 */
export function validateQuestionSelectionMode(mode: any): ValidationResult {
    const validModes: QuestionSelectionMode[] = ["ORDERED", "RANDOM_NO_REPEAT"];
    if (!validModes.includes(mode)) {
        return {
            valid: false,
            error: `question_selection_mode must be one of: ${validModes.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate question_ids list (global plan)
 */
export function validateQuestionIds(questionIds: any): ValidationResult {
    if (!Array.isArray(questionIds)) {
        return {
            valid: false,
            error: "question_ids must be an array",
        };
    }

    if (questionIds.length === 0) {
        return {
            valid: false,
            error: "question_ids cannot be empty",
        };
    }

    for (let i = 0; i < questionIds.length; i++) {
        if (typeof questionIds[i] !== "string" || !questionIds[i]) {
            return {
                valid: false,
                error: `question_ids[${i}] must be a non-empty string`,
            };
        }
    }

    return { valid: true };
}

/**
 * Validate question_count matches list length
 */
export function validateQuestionCount(
    count: any,
    questionIds: string[]
): ValidationResult {
    if (typeof count !== "number" || count < 0) {
        return {
            valid: false,
            error: "question_count must be a non-negative number",
        };
    }

    if (count !== questionIds.length) {
        return {
            valid: false,
            error: `question_count (${count}) does not match question_ids length (${questionIds.length})`,
        };
    }

    return { valid: true };
}

/**
 * Validate guild_question_ids map (per-guild plan)
 */
export function validateGuildQuestionIds(guildQuestionIds: any): ValidationResult {
    if (!guildQuestionIds || typeof guildQuestionIds !== "object" || Array.isArray(guildQuestionIds)) {
        return {
            valid: false,
            error: "guild_question_ids must be an object/map",
        };
    }

    const guildIds = Object.keys(guildQuestionIds);
    if (guildIds.length === 0) {
        return {
            valid: false,
            error: "guild_question_ids cannot be empty",
        };
    }

    for (const guildId of guildIds) {
        const questionIds = guildQuestionIds[guildId];
        if (!Array.isArray(questionIds)) {
            return {
                valid: false,
                error: `guild_question_ids[${guildId}] must be an array`,
            };
        }

        if (questionIds.length === 0) {
            return {
                valid: false,
                error: `guild_question_ids[${guildId}] cannot be empty`,
            };
        }

        for (let i = 0; i < questionIds.length; i++) {
            if (typeof questionIds[i] !== "string" || !questionIds[i]) {
                return {
                    valid: false,
                    error: `guild_question_ids[${guildId}][${i}] must be a non-empty string`,
                };
            }
        }
    }

    return { valid: true };
}

/**
 * Validate guild_question_count map
 */
export function validateGuildQuestionCount(
    guildQuestionCount: any,
    guildQuestionIds: Record<string, string[]>
): ValidationResult {
    if (!guildQuestionCount || typeof guildQuestionCount !== "object" || Array.isArray(guildQuestionCount)) {
        return {
            valid: false,
            error: "guild_question_count must be an object/map",
        };
    }

    // Check all guilds from guild_question_ids are present
    for (const guildId of Object.keys(guildQuestionIds)) {
        const count = guildQuestionCount[guildId];
        if (typeof count !== "number" || count < 0) {
            return {
                valid: false,
                error: `guild_question_count[${guildId}] must be a non-negative number`,
            };
        }

        const expectedCount = guildQuestionIds[guildId].length;
        if (count !== expectedCount) {
            return {
                valid: false,
                error: `guild_question_count[${guildId}] (${count}) does not match question list length (${expectedCount})`,
            };
        }
    }

    // Check no extra guilds in count
    for (const guildId of Object.keys(guildQuestionCount)) {
        if (!guildQuestionIds[guildId]) {
            return {
                valid: false,
                error: `guild_question_count contains unexpected guild ${guildId}`,
            };
        }
    }

    return { valid: true };
}

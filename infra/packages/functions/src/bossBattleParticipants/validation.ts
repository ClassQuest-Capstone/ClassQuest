/**
 * Validation functions for BossBattleParticipants
 */

import { ParticipantState } from "./types.js";

export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

/**
 * Validate participant state enum
 */
export function validateState(state: any): ValidationResult {
    const validStates = Object.values(ParticipantState);
    if (!validStates.includes(state)) {
        return {
            valid: false,
            error: `state must be one of: ${validStates.join(", ")}`,
        };
    }
    return { valid: true };
}

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
 * Validate ISO 8601 timestamp
 */
export function validateISOTimestamp(value: any, fieldName: string): ValidationResult {
    if (typeof value !== "string") {
        return {
            valid: false,
            error: `${fieldName} must be a string`,
        };
    }

    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    if (!isoRegex.test(value)) {
        return {
            valid: false,
            error: `${fieldName} must be a valid ISO 8601 timestamp (e.g., 2026-02-24T12:00:00.000Z)`,
        };
    }

    return { valid: true };
}

/**
 * Validate join participant input
 */
export function validateJoinInput(input: any): ValidationResult {
    // Validate boss_instance_id
    const bossInstanceIdValidation = validateRequiredString(input.boss_instance_id, "boss_instance_id");
    if (!bossInstanceIdValidation.valid) {
        return bossInstanceIdValidation;
    }

    // Validate student_id
    const studentIdValidation = validateRequiredString(input.student_id, "student_id");
    if (!studentIdValidation.valid) {
        return studentIdValidation;
    }

    // Validate class_id
    const classIdValidation = validateRequiredString(input.class_id, "class_id");
    if (!classIdValidation.valid) {
        return classIdValidation;
    }

    // Validate guild_id
    const guildIdValidation = validateRequiredString(input.guild_id, "guild_id");
    if (!guildIdValidation.valid) {
        return guildIdValidation;
    }

    return { valid: true };
}

/**
 * Validate anti-spam fields update input
 */
export function validateAntiSpamFieldsInput(input: any): ValidationResult {
    // Optional last_submit_at
    if (input.last_submit_at !== undefined) {
        const lastSubmitValidation = validateISOTimestamp(input.last_submit_at, "last_submit_at");
        if (!lastSubmitValidation.valid) {
            return lastSubmitValidation;
        }
    }

    // Optional frozen_until
    if (input.frozen_until !== undefined) {
        const frozenUntilValidation = validateISOTimestamp(input.frozen_until, "frozen_until");
        if (!frozenUntilValidation.valid) {
            return frozenUntilValidation;
        }
    }

    return { valid: true };
}

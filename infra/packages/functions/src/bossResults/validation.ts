/**
 * Validation functions for BossResults
 */

import { BattleOutcome, FailReason, ParticipationState } from "./types.js";

export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

/**
 * Validate non-negative number
 */
export function validateNonNegative(value: any, fieldName: string): ValidationResult {
    if (typeof value !== "number" || value < 0) {
        return {
            valid: false,
            error: `${fieldName} must be a non-negative number`,
        };
    }
    return { valid: true };
}

/**
 * Validate battle outcome enum
 */
export function validateOutcome(outcome: any): ValidationResult {
    const validOutcomes: BattleOutcome[] = ["WIN", "FAIL", "ABORTED"];
    if (!validOutcomes.includes(outcome)) {
        return {
            valid: false,
            error: `outcome must be one of: ${validOutcomes.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate fail reason enum
 */
export function validateFailReason(reason: any): ValidationResult {
    const validReasons: FailReason[] = [
        "TIMEOUT",
        "ALL_GUILDS_DOWN",
        "OUT_OF_QUESTIONS",
        "ABORTED_BY_TEACHER",
    ];
    if (!validReasons.includes(reason)) {
        return {
            valid: false,
            error: `fail_reason must be one of: ${validReasons.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate participation state enum
 */
export function validateParticipationState(state: any): ValidationResult {
    const validStates: ParticipationState[] = [
        "JOINED",
        "SPECTATE",
        "KICKED",
        "LEFT",
        "DOWNED",
    ];
    if (!validStates.includes(state)) {
        return {
            valid: false,
            error: `participation_state must be one of: ${validStates.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate ISO timestamp
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
            error: `${fieldName} must be a valid ISO 8601 timestamp`,
        };
    }

    return { valid: true };
}

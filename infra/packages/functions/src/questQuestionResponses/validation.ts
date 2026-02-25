import { ResponseStatus, RewardStatus } from "./types.js";

/**
 * Validate status enum value
 */
export function validateStatus(status: string): { valid: boolean; error?: string } {
    const validStatuses = Object.values(ResponseStatus);
    if (!validStatuses.includes(status as ResponseStatus)) {
        return {
            valid: false,
            error: `status must be one of: ${validStatuses.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate reward_status enum value
 */
export function validateRewardStatus(reward_status: string): { valid: boolean; error?: string } {
    const validStatuses = Object.values(RewardStatus);
    if (!validStatuses.includes(reward_status as RewardStatus)) {
        return {
            valid: false,
            error: `reward_status must be one of: ${validStatuses.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate numeric field is non-negative
 */
export function validateNonNegative(value: number, fieldName: string): { valid: boolean; error?: string } {
    if (typeof value !== "number" || value < 0) {
        return {
            valid: false,
            error: `${fieldName} must be a non-negative number`,
        };
    }
    return { valid: true };
}

/**
 * Validate reward_txn_id is a non-empty string
 */
export function validateRewardTxnId(reward_txn_id: string): { valid: boolean; error?: string } {
    if (typeof reward_txn_id !== "string" || reward_txn_id.trim() === "") {
        return {
            valid: false,
            error: "reward_txn_id must be a non-empty string",
        };
    }
    return { valid: true };
}

/**
 * Validate summary and reward fields
 */
export function validateSummaryAndRewardFields(data: {
    attempt_count?: number;
    wrong_attempt_count?: number;
    status?: string;
    xp_awarded_total?: number;
    gold_awarded_total?: number;
    reward_txn_id?: string;
    reward_status?: string;
}): { valid: boolean; error?: string } {
    // Validate attempt_count
    if (data.attempt_count !== undefined) {
        const validation = validateNonNegative(data.attempt_count, "attempt_count");
        if (!validation.valid) return validation;
    }

    // Validate wrong_attempt_count
    if (data.wrong_attempt_count !== undefined) {
        const validation = validateNonNegative(data.wrong_attempt_count, "wrong_attempt_count");
        if (!validation.valid) return validation;
    }

    // Validate status
    if (data.status !== undefined) {
        const validation = validateStatus(data.status);
        if (!validation.valid) return validation;
    }

    // Validate xp_awarded_total
    if (data.xp_awarded_total !== undefined) {
        const validation = validateNonNegative(data.xp_awarded_total, "xp_awarded_total");
        if (!validation.valid) return validation;
    }

    // Validate gold_awarded_total
    if (data.gold_awarded_total !== undefined) {
        const validation = validateNonNegative(data.gold_awarded_total, "gold_awarded_total");
        if (!validation.valid) return validation;
    }

    // Validate reward_txn_id
    if (data.reward_txn_id !== undefined) {
        const validation = validateRewardTxnId(data.reward_txn_id);
        if (!validation.valid) return validation;
    }

    // Validate reward_status
    if (data.reward_status !== undefined) {
        const validation = validateRewardStatus(data.reward_status);
        if (!validation.valid) return validation;
    }

    return { valid: true };
}

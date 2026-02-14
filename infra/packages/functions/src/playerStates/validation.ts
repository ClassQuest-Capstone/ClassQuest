import type { PlayerStateStatus } from "./types.js";

export type ValidationError = {
    field: string;
    error: string;
};

/**
 * Validate player state fields
 * Returns array of validation errors (empty if valid)
 */
export function validatePlayerState(data: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required fields
    const required = [
        "current_xp",
        "xp_to_next_level",
        "total_xp_earned",
        "hearts",
        "max_hearts",
        "gold",
        "status",
    ];

    for (const field of required) {
        if (data[field] === undefined || data[field] === null) {
            errors.push({ field, error: "required" });
        }
    }

    // Type validation for numbers
    const numberFields = [
        "current_xp",
        "xp_to_next_level",
        "total_xp_earned",
        "hearts",
        "max_hearts",
        "gold",
    ];

    for (const field of numberFields) {
        if (data[field] !== undefined && typeof data[field] !== "number") {
            errors.push({ field, error: "must be a number" });
        }
    }

    // Numeric fields >= 0
    for (const field of numberFields) {
        if (typeof data[field] === "number" && data[field] < 0) {
            errors.push({ field, error: "must be >= 0" });
        }
    }

    // hearts <= max_hearts
    if (
        typeof data.hearts === "number" &&
        typeof data.max_hearts === "number" &&
        data.hearts > data.max_hearts
    ) {
        errors.push({ field: "hearts", error: "cannot exceed max_hearts" });
    }

    // Status enum validation
    const validStatuses: PlayerStateStatus[] = ["ALIVE", "DOWNED", "BANNED"];
    if (data.status && !validStatuses.includes(data.status)) {
        errors.push({
            field: "status",
            error: `must be one of: ${validStatuses.join(", ")}`,
        });
    }

    // ISO string validation for last_weekend_reset_at (if provided)
    if (data.last_weekend_reset_at !== undefined) {
        if (typeof data.last_weekend_reset_at !== "string") {
            errors.push({ field: "last_weekend_reset_at", error: "must be a string" });
        } else {
            const date = new Date(data.last_weekend_reset_at);
            if (isNaN(date.getTime())) {
                errors.push({
                    field: "last_weekend_reset_at",
                    error: "must be a valid ISO 8601 timestamp",
                });
            }
        }
    }

    return errors;
}

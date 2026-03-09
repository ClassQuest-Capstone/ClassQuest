import { CLAIM_STATUSES, REWARD_TARGET_TYPES } from "./keys.ts";

export type ValidationError = { field: string; message: string };

/**
 * Validate required fields and formats for creating a student reward claim.
 */
export function validateCreateInput(body: any): ValidationError[] {
    const errors: ValidationError[] = [];

    const required = [
        "student_id",
        "class_id",
        "reward_id",
        "status",
        "unlocked_at_level",
        "reward_target_type",
        "reward_target_id",
    ];
    for (const field of required) {
        if (body[field] === undefined || body[field] === null || body[field] === "") {
            errors.push({ field, message: "required" });
        }
    }

    if (body.status !== undefined && !CLAIM_STATUSES.includes(body.status)) {
        errors.push({
            field: "status",
            message: `must be one of: ${CLAIM_STATUSES.join(", ")}`,
        });
    }

    if (body.unlocked_at_level !== undefined) {
        const level = Number(body.unlocked_at_level);
        if (!Number.isInteger(level) || level < 1) {
            errors.push({ field: "unlocked_at_level", message: "must be an integer >= 1" });
        }
    }

    if (
        body.reward_target_type !== undefined &&
        !REWARD_TARGET_TYPES.includes(body.reward_target_type)
    ) {
        errors.push({
            field: "reward_target_type",
            message: `must be one of: ${REWARD_TARGET_TYPES.join(", ")}`,
        });
    }

    return errors;
}

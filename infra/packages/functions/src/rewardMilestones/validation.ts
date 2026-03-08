import { REWARD_TYPES, REWARD_TARGET_TYPES } from "./keys.ts";

export type ValidationError = { field: string; message: string };

/**
 * Validate required fields and formats for creating a reward milestone.
 */
export function validateCreateInput(body: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required presence check
    const required = [
        "class_id",
        "title",
        "description",
        "unlock_level",
        "type",
    ];
    for (const field of required) {
        if (body[field] === undefined || body[field] === null || body[field] === "") {
            errors.push({ field, message: "required" });
        }
    }

    if (typeof body.title === "string") {
        if (body.title.length < 1 || body.title.length > 100) {
            errors.push({ field: "title", message: "must be 1-100 characters" });
        }
    }

    if (typeof body.description === "string") {
        if (body.description.length < 1 || body.description.length > 300) {
            errors.push({ field: "description", message: "must be 1-300 characters" });
        }
    }

    if (body.unlock_level !== undefined) {
        const level = Number(body.unlock_level);
        if (!Number.isInteger(level) || level < 1) {
            errors.push({ field: "unlock_level", message: "must be an integer >= 1" });
        }
    }

    if (body.type !== undefined && !REWARD_TYPES.includes(body.type)) {
        errors.push({ field: "type", message: `must be one of: ${REWARD_TYPES.join(", ")}` });
    }

    if (body.reward_target_type !== undefined && !REWARD_TARGET_TYPES.includes(body.reward_target_type)) {
        errors.push({
            field: "reward_target_type",
            message: `must be one of: ${REWARD_TARGET_TYPES.join(", ")}`,
        });
    }

    return errors;
}

/**
 * Validate fields allowed in an update request.
 * Only validates fields that are actually provided.
 */
export function validateUpdateInput(body: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (body.title !== undefined) {
        if (typeof body.title !== "string" || body.title.length < 1 || body.title.length > 100) {
            errors.push({ field: "title", message: "must be 1-100 characters" });
        }
    }

    if (body.description !== undefined) {
        if (
            typeof body.description !== "string" ||
            body.description.length < 1 ||
            body.description.length > 300
        ) {
            errors.push({ field: "description", message: "must be 1-300 characters" });
        }
    }

    if (body.unlock_level !== undefined) {
        const level = Number(body.unlock_level);
        if (!Number.isInteger(level) || level < 1) {
            errors.push({ field: "unlock_level", message: "must be an integer >= 1" });
        }
    }

    if (body.type !== undefined && !REWARD_TYPES.includes(body.type)) {
        errors.push({ field: "type", message: `must be one of: ${REWARD_TYPES.join(", ")}` });
    }

    if (body.reward_target_type !== undefined && !REWARD_TARGET_TYPES.includes(body.reward_target_type)) {
        errors.push({
            field: "reward_target_type",
            message: `must be one of: ${REWARD_TARGET_TYPES.join(", ")}`,
        });
    }

    return errors;
}

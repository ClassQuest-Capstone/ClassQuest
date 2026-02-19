export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

/**
 * Validate boss battle template creation/update input
 */
export function validateTemplate(input: {
    title?: string;
    description?: string;
    max_hp?: number;
    base_xp_reward?: number;
    base_gold_reward?: number;
    is_shared_publicly?: any;
}): ValidationResult {
    // Validate title
    if (input.title !== undefined) {
        if (typeof input.title !== "string" || input.title.trim().length === 0) {
            return {
                valid: false,
                error: "title must be a non-empty string",
            };
        }
    }

    // Validate description
    if (input.description !== undefined) {
        if (typeof input.description !== "string") {
            return {
                valid: false,
                error: "description must be a string",
            };
        }
    }

    // Validate max_hp
    if (input.max_hp !== undefined) {
        if (typeof input.max_hp !== "number" || input.max_hp <= 0) {
            return {
                valid: false,
                error: "max_hp must be a positive number",
            };
        }
    }

    // Validate base_xp_reward
    if (input.base_xp_reward !== undefined) {
        if (typeof input.base_xp_reward !== "number" || input.base_xp_reward < 0) {
            return {
                valid: false,
                error: "base_xp_reward must be a non-negative number",
            };
        }
    }

    // Validate base_gold_reward
    if (input.base_gold_reward !== undefined) {
        if (typeof input.base_gold_reward !== "number" || input.base_gold_reward < 0) {
            return {
                valid: false,
                error: "base_gold_reward must be a non-negative number",
            };
        }
    }

    // Validate is_shared_publicly
    if (input.is_shared_publicly !== undefined) {
        if (typeof input.is_shared_publicly !== "boolean") {
            return {
                valid: false,
                error: "is_shared_publicly must be a boolean",
            };
        }
    }

    return { valid: true };
}

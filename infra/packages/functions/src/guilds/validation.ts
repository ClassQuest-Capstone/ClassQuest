export type ValidationError = {
    field: string;
    error: string;
};

/**
 * Validate guild name
 */
export function validateGuildName(name: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (name === undefined || name === null) {
        errors.push({ field: "name", error: "required" });
        return errors;
    }

    if (typeof name !== "string") {
        errors.push({ field: "name", error: "must be a string" });
        return errors;
    }

    const trimmed = name.trim();
    if (trimmed.length === 0) {
        errors.push({ field: "name", error: "cannot be empty" });
    }

    return errors;
}

/**
 * Validate guild update patch
 */
export function validateGuildPatch(patch: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (patch.name !== undefined) {
        const nameErrors = validateGuildName(patch.name);
        errors.push(...nameErrors);
    }

    if (patch.is_active !== undefined && typeof patch.is_active !== "boolean") {
        errors.push({ field: "is_active", error: "must be a boolean" });
    }

    return errors;
}

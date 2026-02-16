export type ValidationError = {
    field: string;
    error: string;
};

/**
 * Validate password (basic check - Cognito will enforce full policy)
 * Cognito policy requires: minLength 6, digits, lowercase, uppercase, symbols
 */
export function validatePassword(password: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (password === undefined || password === null) {
        errors.push({ field: "password", error: "required" });
        return errors;
    }

    if (typeof password !== "string") {
        errors.push({ field: "password", error: "must be a string" });
        return errors;
    }

    if (password.length < 6) {
        errors.push({ field: "password", error: "must be at least 6 characters" });
    }

    if (password.length > 256) {
        errors.push({ field: "password", error: "must be at most 256 characters" });
    }

    return errors;
}

/**
 * Validate username format
 * Rules: 3-50 chars, alphanumeric + underscore only
 */
export function validateUsername(username: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (username === undefined || username === null) {
        errors.push({ field: "username", error: "required" });
        return errors;
    }

    if (typeof username !== "string") {
        errors.push({ field: "username", error: "must be a string" });
        return errors;
    }

    const trimmed = username.trim();

    if (trimmed.length < 3) {
        errors.push({ field: "username", error: "must be at least 3 characters" });
    }

    if (trimmed.length > 50) {
        errors.push({ field: "username", error: "must be at most 50 characters" });
    }

    // Alphanumeric + underscore only
    const validPattern = /^[a-zA-Z0-9_]+$/;
    if (!validPattern.test(trimmed)) {
        errors.push({ field: "username", error: "must contain only letters, numbers, and underscores" });
    }

    return errors;
}

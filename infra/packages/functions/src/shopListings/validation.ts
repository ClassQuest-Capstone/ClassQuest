export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate fields for ShopListing create or update.
 * All fields are optional — only supplied fields are validated.
 *
 * listing_status is internally derived and must never be supplied by callers.
 */
export function validateShopListing(input: {
    shop_listing_id?: string;
    item_id?: string;
    available_from?: string;
    available_to?: string;
    class_id?: string | null;
    purchase_limit_per_student?: number | null;
    is_active?: boolean;
    display_order?: number | null;
    listing_status?: unknown;     // always rejected if present
}): ValidationResult {

    if (input.listing_status !== undefined) {
        return {
            valid: false,
            error: "listing_status is derived internally and must not be supplied",
        };
    }

    if (input.shop_listing_id !== undefined) {
        if (typeof input.shop_listing_id !== "string" || input.shop_listing_id.trim().length === 0) {
            return { valid: false, error: "shop_listing_id must be a non-empty string" };
        }
        if (!SAFE_ID_RE.test(input.shop_listing_id)) {
            return {
                valid: false,
                error: "shop_listing_id may only contain letters, digits, underscores, and hyphens",
            };
        }
    }

    if (input.item_id !== undefined) {
        if (typeof input.item_id !== "string" || input.item_id.trim().length === 0) {
            return { valid: false, error: "item_id must be a non-empty string" };
        }
    }

    if (input.available_from !== undefined) {
        if (typeof input.available_from !== "string" || isNaN(Date.parse(input.available_from))) {
            return { valid: false, error: "available_from must be a valid ISO 8601 timestamp" };
        }
    }

    if (input.available_to !== undefined) {
        if (typeof input.available_to !== "string" || isNaN(Date.parse(input.available_to))) {
            return { valid: false, error: "available_to must be a valid ISO 8601 timestamp" };
        }
    }

    // Cross-field: available_to must be >= available_from
    if (input.available_from !== undefined && input.available_to !== undefined) {
        if (new Date(input.available_to) < new Date(input.available_from)) {
            return { valid: false, error: "available_to must be greater than or equal to available_from" };
        }
    }

    if (input.class_id !== undefined && input.class_id !== null) {
        if (typeof input.class_id !== "string" || input.class_id.trim().length === 0) {
            return { valid: false, error: "class_id must be a non-empty string when provided" };
        }
    }

    if (input.purchase_limit_per_student !== undefined && input.purchase_limit_per_student !== null) {
        if (
            !Number.isInteger(input.purchase_limit_per_student) ||
            input.purchase_limit_per_student < 1
        ) {
            return {
                valid: false,
                error: "purchase_limit_per_student must be an integer >= 1 when provided",
            };
        }
    }

    if (input.is_active !== undefined) {
        if (typeof input.is_active !== "boolean") {
            return { valid: false, error: "is_active must be a boolean" };
        }
    }

    if (input.display_order !== undefined && input.display_order !== null) {
        if (typeof input.display_order !== "number") {
            return { valid: false, error: "display_order must be a number when provided" };
        }
    }

    return { valid: true };
}

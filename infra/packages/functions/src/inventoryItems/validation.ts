import { ACQUIRED_FROM_VALUES } from "./types.ts";
import type { AcquiredFrom } from "./types.ts";

export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate fields for InventoryItem create, update, or grant.
 * All fields are optional — only supplied fields are validated.
 */
export function validateInventoryItem(input: {
    student_id?: string;
    class_id?: string;
    item_id?: string;
    quantity?: number;
    acquired_from?: string;
    acquired_at?: string;
}): ValidationResult {

    if (input.student_id !== undefined) {
        if (typeof input.student_id !== "string" || input.student_id.trim().length === 0) {
            return { valid: false, error: "student_id must be a non-empty string" };
        }
        if (!SAFE_ID_RE.test(input.student_id)) {
            return { valid: false, error: "student_id contains invalid characters" };
        }
    }

    if (input.class_id !== undefined) {
        if (typeof input.class_id !== "string" || input.class_id.trim().length === 0) {
            return { valid: false, error: "class_id must be a non-empty string" };
        }
        if (!SAFE_ID_RE.test(input.class_id)) {
            return { valid: false, error: "class_id contains invalid characters" };
        }
    }

    if (input.item_id !== undefined) {
        if (typeof input.item_id !== "string" || input.item_id.trim().length === 0) {
            return { valid: false, error: "item_id must be a non-empty string" };
        }
    }

    if (input.quantity !== undefined) {
        if (!Number.isInteger(input.quantity) || input.quantity < 1) {
            return { valid: false, error: "quantity must be an integer >= 1" };
        }
    }

    if (input.acquired_from !== undefined) {
        if (!ACQUIRED_FROM_VALUES.includes(input.acquired_from as AcquiredFrom)) {
            return {
                valid: false,
                error: `acquired_from must be one of: ${ACQUIRED_FROM_VALUES.join(", ")}`,
            };
        }
    }

    if (input.acquired_at !== undefined) {
        if (typeof input.acquired_at !== "string" || isNaN(Date.parse(input.acquired_at))) {
            return { valid: false, error: "acquired_at must be a valid ISO 8601 timestamp" };
        }
    }

    return { valid: true };
}

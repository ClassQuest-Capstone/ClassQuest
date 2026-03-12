import type { ShopRarity } from "./types.ts";

export const VALID_RARITIES: ShopRarity[] = [
    "COMMON",
    "UNCOMMON",
    "RARE",
    "EPIC",
    "LEGENDARY",
];

export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

/**
 * Validate fields for ShopItem create or update.
 * All fields are optional — only provided fields are validated.
 */
export function validateShopItem(input: {
    item_id?: string;
    name?: string;
    description?: string;
    category?: string;
    rarity?: string;
    gold_cost?: number;
    required_level?: number;
    is_cosmetic_only?: boolean;
    sprite_path?: string;
    is_active?: boolean;
}): ValidationResult {
    if (input.item_id !== undefined) {
        if (typeof input.item_id !== "string" || input.item_id.trim().length === 0) {
            return { valid: false, error: "item_id must be a non-empty string" };
        }
        if (!/^[a-z0-9_-]+$/.test(input.item_id)) {
            return {
                valid: false,
                error: "item_id may only contain lowercase letters, digits, underscores, and hyphens",
            };
        }
    }

    if (input.name !== undefined) {
        if (typeof input.name !== "string" || input.name.trim().length === 0) {
            return { valid: false, error: "name must be a non-empty string" };
        }
        if (input.name.trim().length > 100) {
            return { valid: false, error: "name must be 100 characters or fewer" };
        }
    }

    if (input.description !== undefined) {
        if (typeof input.description !== "string") {
            return { valid: false, error: "description must be a string" };
        }
        if (input.description.length > 500) {
            return { valid: false, error: "description must be 500 characters or fewer" };
        }
    }

    if (input.category !== undefined) {
        if (typeof input.category !== "string" || input.category.trim().length === 0) {
            return { valid: false, error: "category must be a non-empty string" };
        }
        if (!/^[A-Z0-9_]+$/.test(input.category)) {
            return {
                valid: false,
                error: "category must be uppercase letters, digits, or underscores (e.g. HAT, ARMOR_SET)",
            };
        }
    }

    if (input.rarity !== undefined) {
        if (!VALID_RARITIES.includes(input.rarity as ShopRarity)) {
            return {
                valid: false,
                error: `rarity must be one of: ${VALID_RARITIES.join(", ")}`,
            };
        }
    }

    if (input.gold_cost !== undefined) {
        if (!Number.isInteger(input.gold_cost) || input.gold_cost < 0 || input.gold_cost > 999999) {
            return {
                valid: false,
                error: "gold_cost must be a non-negative integer between 0 and 999999",
            };
        }
    }

    if (input.required_level !== undefined) {
        if (!Number.isInteger(input.required_level) || input.required_level < 0 || input.required_level > 999) {
            return {
                valid: false,
                error: "required_level must be a non-negative integer between 0 and 999",
            };
        }
    }

    if (input.is_cosmetic_only !== undefined) {
        if (typeof input.is_cosmetic_only !== "boolean") {
            return { valid: false, error: "is_cosmetic_only must be a boolean" };
        }
    }

    if (input.sprite_path !== undefined) {
        if (typeof input.sprite_path !== "string" || input.sprite_path.trim().length === 0) {
            return { valid: false, error: "sprite_path must be a non-empty string" };
        }
    }

    if (input.is_active !== undefined) {
        if (typeof input.is_active !== "boolean") {
            return { valid: false, error: "is_active must be a boolean" };
        }
    }

    return { valid: true };
}

import type { AvatarGender, AvatarRoleType, AvatarColorType } from "./types.ts";

export const VALID_GENDERS: AvatarGender[] = ["MALE", "FEMALE"];
export const VALID_ROLE_TYPES: AvatarRoleType[] = ["HEALER", "GUARDIAN", "MAGE", "NONE"];
export const VALID_COLOR_TYPES: AvatarColorType[] = ["BROWN", "WHITE", "DARK"];

export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

/**
 * Validate fields for AvatarBase create or update.
 * All fields are optional — only provided fields are validated.
 */
export function validateAvatarBase(input: {
    avatar_base_id?: string;
    gender?: string;
    role_type?: string;
    is_default?: boolean;
    color_type?: string;
    default_character_image_key?: string;
    default_helmet_item_id?: string;
    default_armour_item_id?: string;
    default_shield_item_id?: string;
    default_pet_item_id?: string;
    default_background_item_id?: string;
}): ValidationResult {
    if (input.avatar_base_id !== undefined) {
        if (typeof input.avatar_base_id !== "string" || input.avatar_base_id.trim().length === 0) {
            return { valid: false, error: "avatar_base_id must be a non-empty string" };
        }
        if (!/^[a-z0-9_-]+$/.test(input.avatar_base_id)) {
            return {
                valid: false,
                error: "avatar_base_id may only contain lowercase letters, digits, underscores, and hyphens",
            };
        }
    }

    if (input.gender !== undefined) {
        if (!VALID_GENDERS.includes(input.gender as AvatarGender)) {
            return {
                valid: false,
                error: `gender must be one of: ${VALID_GENDERS.join(", ")}`,
            };
        }
    }

    if (input.role_type !== undefined) {
        if (!VALID_ROLE_TYPES.includes(input.role_type as AvatarRoleType)) {
            return {
                valid: false,
                error: `role_type must be one of: ${VALID_ROLE_TYPES.join(", ")}`,
            };
        }
    }

    if (input.is_default !== undefined) {
        if (typeof input.is_default !== "boolean") {
            return { valid: false, error: "is_default must be a boolean" };
        }
    }

    if (input.color_type !== undefined) {
        if (!VALID_COLOR_TYPES.includes(input.color_type as AvatarColorType)) {
            return {
                valid: false,
                error: `color_type must be one of: ${VALID_COLOR_TYPES.join(", ")}`,
            };
        }
    }

    if (input.default_character_image_key !== undefined) {
        if (
            typeof input.default_character_image_key !== "string" ||
            input.default_character_image_key.trim().length === 0
        ) {
            return { valid: false, error: "default_character_image_key must be a non-empty string" };
        }
    }

    // Validate each optional default gear item id — must be non-empty string if provided
    const gearFields = [
        "default_helmet_item_id",
        "default_armour_item_id",
        "default_shield_item_id",
        "default_pet_item_id",
        "default_background_item_id",
    ] as const;

    for (const field of gearFields) {
        const value = input[field];
        if (value !== undefined) {
            if (typeof value !== "string" || value.trim().length === 0) {
                return { valid: false, error: `${field} must be a non-empty string` };
            }
        }
    }

    return { valid: true };
}

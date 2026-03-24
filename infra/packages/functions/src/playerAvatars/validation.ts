import type { PlayerAvatarGender, GearSlot } from "./types.ts";

export const VALID_AVATAR_GENDERS: PlayerAvatarGender[] = ["MALE", "FEMALE"];

export const VALID_GEAR_SLOTS: GearSlot[] = ["helmet", "armour", "shield", "pet", "background"];

/** Maps gear slot name → ShopItems category value */
export const SLOT_TO_SHOP_CATEGORY: Record<GearSlot, string> = {
    helmet:     "HELMET",
    armour:     "ARMOUR",
    shield:     "SHIELD",
    pet:        "PET",
    background: "BACKGROUND",
};

export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

/**
 * Validate fields for PlayerAvatar create or update.
 * All fields are optional — only provided fields are validated.
 */
export function validatePlayerAvatar(input: {
    class_id?: string;
    student_id?: string;
    avatar_base_id?: string;
    gender?: string;
    equipped_helmet_item_id?: string;
    equipped_armour_item_id?: string;
    equipped_shield_item_id?: string;
    equipped_pet_item_id?: string;
    equipped_background_item_id?: string;
}): ValidationResult {
    if (input.class_id !== undefined) {
        if (typeof input.class_id !== "string" || input.class_id.trim().length === 0) {
            return { valid: false, error: "class_id must be a non-empty string" };
        }
    }

    if (input.student_id !== undefined) {
        if (typeof input.student_id !== "string" || input.student_id.trim().length === 0) {
            return { valid: false, error: "student_id must be a non-empty string" };
        }
    }

    if (input.avatar_base_id !== undefined) {
        if (typeof input.avatar_base_id !== "string" || input.avatar_base_id.trim().length === 0) {
            return { valid: false, error: "avatar_base_id must be a non-empty string" };
        }
    }

    if (input.gender !== undefined) {
        if (!VALID_AVATAR_GENDERS.includes(input.gender as PlayerAvatarGender)) {
            return {
                valid: false,
                error: `gender must be one of: ${VALID_AVATAR_GENDERS.join(", ")}`,
            };
        }
    }

    // Validate each optional equipped slot — must be non-empty string if provided
    const slotFields = [
        "equipped_helmet_item_id",
        "equipped_armour_item_id",
        "equipped_shield_item_id",
        "equipped_pet_item_id",
        "equipped_background_item_id",
    ] as const;

    for (const field of slotFields) {
        const value = input[field];
        if (value !== undefined) {
            if (typeof value !== "string" || value.trim().length === 0) {
                return { valid: false, error: `${field} must be a non-empty string` };
            }
        }
    }

    return { valid: true };
}

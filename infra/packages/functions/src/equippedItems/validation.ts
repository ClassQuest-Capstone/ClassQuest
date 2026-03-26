import type { EquipSlot } from "./types.ts";

export const VALID_EQUIP_SLOTS: EquipSlot[] = ["helmet", "armour", "hand_item", "pet", "background"];

export const SLOT_TO_SHOP_CATEGORY: Record<EquipSlot, string> = {
    helmet:     "HELMET",
    armour:     "ARMOUR",
    hand_item:  "HAND_ITEM",
    pet:        "PET",
    background: "BACKGROUND",
};

// AvatarBases stores the hand slot default under default_shield_item_id (legacy naming)
export const SLOT_TO_DEFAULT_FIELD: Record<EquipSlot, string> = {
    helmet:     "default_helmet_item_id",
    armour:     "default_armour_item_id",
    hand_item:  "default_shield_item_id",
    pet:        "default_pet_item_id",
    background: "default_background_item_id",
};

export type ValidationResult = { valid: true } | { valid: false; error: string };

export function validateCreateInput(input: { class_id?: string; student_id?: string; avatar_base_id?: string }): ValidationResult {
    if (!input.class_id || typeof input.class_id !== "string" || input.class_id.trim().length === 0)
        return { valid: false, error: "class_id must be a non-empty string" };
    if (!input.student_id || typeof input.student_id !== "string" || input.student_id.trim().length === 0)
        return { valid: false, error: "student_id must be a non-empty string" };
    if (!input.avatar_base_id || typeof input.avatar_base_id !== "string" || input.avatar_base_id.trim().length === 0)
        return { valid: false, error: "avatar_base_id must be a non-empty string" };
    return { valid: true };
}

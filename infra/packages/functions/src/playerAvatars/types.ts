/**
 * Avatar gender for equip validation — matches AvatarBases.gender and ShopItems gear gender.
 */
export type PlayerAvatarGender = "MALE" | "FEMALE";

/**
 * Valid gear slot names (lowercase). Maps to equipped_*_item_id fields and ShopItems categories.
 */
export type GearSlot = "helmet" | "armour" | "shield" | "pet" | "background";

/**
 * PlayerAvatar record — one per student per class.
 * Stores the student's currently selected avatar base and equipped gear per slot.
 *
 * Primary key: player_avatar_id
 * GSI1:        gsi1pk (CLASS#{class_id}) / gsi1sk (STUDENT#{student_id})
 *
 * This is avatar STATE, not ownership (that's InventoryItems) and not item catalogue (that's ShopItems).
 * Default fallback item ids live in AvatarBases.
 */
export type PlayerAvatar = {
    // ── Primary key ──────────────────────────────────────────────────────────
    player_avatar_id: string;

    // ── Business fields ───────────────────────────────────────────────────────
    class_id: string;
    student_id: string;
    avatar_base_id: string;         // references AvatarBases.avatar_base_id
    gender: PlayerAvatarGender;

    // ── Equipped gear slots (each optional — absent = slot uses AvatarBases default) ──
    equipped_helmet_item_id?: string;
    equipped_armour_item_id?: string;
    equipped_shield_item_id?: string;
    equipped_pet_item_id?: string;
    equipped_background_item_id?: string;

    // ── GSI keys ─────────────────────────────────────────────────────────────
    gsi1pk: string;                 // CLASS#{class_id}
    gsi1sk: string;                 // STUDENT#{student_id}

    // ── Timestamp ─────────────────────────────────────────────────────────────
    updated_at: string;             // ISO 8601
};

/**
 * Fields the caller supplies when creating a new PlayerAvatar.
 */
export type CreatePlayerAvatarInput = {
    class_id: string;
    student_id: string;
    avatar_base_id: string;
    gender: PlayerAvatarGender;
    equipped_helmet_item_id?: string;
    equipped_armour_item_id?: string;
    equipped_shield_item_id?: string;
    equipped_pet_item_id?: string;
    equipped_background_item_id?: string;
};

/**
 * Fields that may be changed via PATCH /player-avatars/{player_avatar_id}.
 */
export type UpdatePlayerAvatarInput = Partial<{
    avatar_base_id: string;
    gender: PlayerAvatarGender;
    equipped_helmet_item_id: string;
    equipped_armour_item_id: string;
    equipped_shield_item_id: string;
    equipped_pet_item_id: string;
    equipped_background_item_id: string;
}>;

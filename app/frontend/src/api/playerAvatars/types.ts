/**
 * Avatar gender for equip validation.
 */
export type PlayerAvatarGender = "MALE" | "FEMALE";

/**
 * Valid gear slot names.
 */
export type GearSlot = "helmet" | "armour" | "shield" | "pet" | "background";

/**
 * PlayerAvatar as returned by the API.
 * One record per student per class. Stores current equipped gear state.
 */
export type PlayerAvatar = {
    player_avatar_id: string;
    class_id: string;
    student_id: string;
    avatar_base_id: string;
    gender: PlayerAvatarGender;
    equipped_helmet_item_id?: string;
    equipped_armour_item_id?: string;
    equipped_shield_item_id?: string;
    equipped_pet_item_id?: string;
    equipped_background_item_id?: string;
    updated_at: string;
};

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

export type UpdatePlayerAvatarInput = Partial<{
    avatar_base_id: string;
    gender: PlayerAvatarGender;
    equipped_helmet_item_id: string;
    equipped_armour_item_id: string;
    equipped_shield_item_id: string;
    equipped_pet_item_id: string;
    equipped_background_item_id: string;
}>;

export type EquipItemInput = {
    slot: GearSlot;
    item_id: string;
};

export type UnequipItemInput = {
    slot: GearSlot;
};

export type PaginatedPlayerAvatars = {
    items: PlayerAvatar[];
    cursor?: string | null;
    count: number;
    class_id?: string;
};

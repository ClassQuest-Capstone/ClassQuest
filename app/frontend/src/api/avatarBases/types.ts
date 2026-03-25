/**
 * Avatar gender — defines which avatar body type this base applies to.
 */
export type AvatarGender = "MALE" | "FEMALE";

/**
 * Avatar role type — the class/role this avatar base is associated with.
 * NONE means no role restriction (generic base).
 */
export type AvatarRoleType = "HEALER" | "GUARDIAN" | "MAGE" | "NONE";

/**
 * Skin/color variant for the avatar base.
 * Optional — not all bases have a color variant.
 */
export type AvatarColorType = "BROWN" | "WHITE" | "DARK";

/**
 * AvatarBase as returned by the API.
 * This is config/master data — not ownership or equip state.
 * Default gear item ids reference ShopItems.item_id.
 * default_character_image_key is an S3 key/path for the full default character
 * appearance. Only a reference — not a generated URL.
 */
export type AvatarBase = {
    avatar_base_id: string;
    gender: AvatarGender;
    role_type: AvatarRoleType;
    is_default: boolean;
    color_type?: AvatarColorType;
    default_character_image_key?: string;
    default_helmet_item_id?: string;
    default_armour_item_id?: string;
    default_shield_item_id?: string;
    default_pet_item_id?: string;
    default_background_item_id?: string;
    created_at: string;
    updated_at: string;
};

export type CreateAvatarBaseInput = {
    avatar_base_id: string;
    gender: AvatarGender;
    role_type: AvatarRoleType;
    is_default: boolean;
    color_type?: AvatarColorType;
    default_character_image_key?: string;
    default_helmet_item_id?: string;
    default_armour_item_id?: string;
    default_shield_item_id?: string;
    default_pet_item_id?: string;
    default_background_item_id?: string;
};

export type UpdateAvatarBaseInput = Partial<{
    gender: AvatarGender;
    role_type: AvatarRoleType;
    is_default: boolean;
    color_type: AvatarColorType;
    default_character_image_key: string;
    default_helmet_item_id: string;
    default_armour_item_id: string;
    default_shield_item_id: string;
    default_pet_item_id: string;
    default_background_item_id: string;
}>;

export type PaginatedAvatarBases = {
    items: AvatarBase[];
    cursor?: string | null;
    count: number;
    gender?: AvatarGender;
};

export type ListAvatarBasesOptions = {
    limit?: number;
    cursor?: string;
    gender?: AvatarGender;
};

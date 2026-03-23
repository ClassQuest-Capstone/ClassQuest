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
 * AvatarBase record stored in DynamoDB.
 *
 * Primary key: avatar_base_id
 * GSI1: gender (PK) / role_type (SK) — list by gender or gender+role
 *
 * This is a master/config table — not ownership or equip state.
 * Default gear item ids reference ShopItems.item_id and are used
 * as fallback when a student deselects an equipped gear slot.
 */
export type AvatarBase = {
    avatar_base_id: string;
    gender: AvatarGender;
    role_type: AvatarRoleType;
    is_default: boolean;
    default_helmet_item_id?: string;
    default_armour_item_id?: string;
    default_shield_item_id?: string;
    default_pet_item_id?: string;
    default_background_item_id?: string;
    created_at: string;
    updated_at: string;
};

/**
 * Fields the caller supplies when creating a new AvatarBase.
 * Timestamps are computed by the handler.
 */
export type CreateAvatarBaseInput = Omit<AvatarBase, "created_at" | "updated_at">;

/**
 * Fields that may be changed via PATCH /avatar-bases/{avatar_base_id}.
 */
export type UpdateAvatarBaseInput = Partial<
    Pick<
        AvatarBase,
        | "gender"
        | "role_type"
        | "is_default"
        | "default_helmet_item_id"
        | "default_armour_item_id"
        | "default_shield_item_id"
        | "default_pet_item_id"
        | "default_background_item_id"
    >
>;

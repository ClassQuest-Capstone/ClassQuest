/**
 * ShopItem rarity tiers
 */
export type ShopRarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";

/**
 * Avatar gear gender — UNISEX items can be equipped by any avatar.
 */
export type ShopGearGender = "MALE" | "FEMALE" | "UNISEX";

/**
 * ShopItem categories — includes gear categories (HELMET, ARMOUR, SHIELD, PET, BACKGROUND)
 * and general shop categories.
 */
export type ShopCategory =
    | "CLASS_ITEMS"
    | "COSMETIC"
    | "POWER_UPS"
    | "OTHER"
    | "HELMET"
    | "ARMOUR"
    | "SHIELD"
    | "PET"
    | "BACKGROUND";

/** Gear categories that require gender and asset_key */
export const GEAR_CATEGORIES: ShopCategory[] = ["HELMET", "ARMOUR", "SHIELD", "PET", "BACKGROUND"];

/**
 * ShopItem as returned by the API.
 */
export type ShopItem = {
    item_id: string;
    name: string;
    description: string;
    category: ShopCategory;
    rarity: ShopRarity;
    gold_cost: number;
    required_level: number;
    is_cosmetic_only: boolean;
    sprite_path: string;
    is_active: boolean;
    // Gear-only fields — present only on gear items
    gender?: ShopGearGender;
    asset_key?: string;
    created_at: string;
    updated_at: string;
};

export type CreateShopItemInput = {
    item_id: string;
    name: string;
    description: string;
    category: string;
    rarity: ShopRarity;
    gold_cost: number;
    required_level: number;
    is_cosmetic_only: boolean;
    sprite_path: string;
    is_active?: boolean;
    gender?: ShopGearGender;
    asset_key?: string;
};

export type UpdateShopItemInput = Partial<{
    name: string;
    description: string;
    category: string;
    rarity: ShopRarity;
    gold_cost: number;
    required_level: number;
    is_cosmetic_only: boolean;
    sprite_path: string;
    gender: ShopGearGender;
    asset_key: string;
}>;

export type PaginatedShopItems = {
    items: ShopItem[];
    cursor?: string | null;
    count: number;
};

export type PaginationOptions = {
    limit?: number;
    cursor?: string;
};

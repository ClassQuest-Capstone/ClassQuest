/**
 * ShopItem rarity tiers
 */
export type ShopRarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";

/**
 * ShopItem categories
 */
export type ShopCategory = "CLASS_ITEMS" | "COSMETIC" | "POWER_UPS" | "OTHER";
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

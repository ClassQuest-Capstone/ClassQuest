/**
 * ShopItem rarity tiers
 */
export type ShopRarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";

/**
 * Avatar gear gender — used to restrict gear to a specific avatar type.
 * UNISEX items can be equipped by any avatar.
 */
export type ShopGearGender = "MALE" | "FEMALE" | "UNISEX";

/**
 * ShopItem record stored in DynamoDB.
 *
 * Primary key:  item_pk (SHOPITEM#{item_id}) + item_sk (META)
 * GSI1:         gsi1pk  (SHOP#ACTIVE | SHOP#INACTIVE)  / gsi1sk (CATEGORY#...#LEVEL#...#PRICE#...#RARITY#...#ITEM#...)
 * GSI2:         gsi2pk  (CATEGORY#{category})           / gsi2sk (LEVEL#...#PRICE#...#ITEM#...)
 */
export type ShopItem = {
    // ── Primary key ──────────────────────────────────────────────────────────
    item_pk: string;            // SHOPITEM#{item_id}
    item_sk: "META";            // always "META" — every item has exactly one META row

    // ── Business fields ───────────────────────────────────────────────────────
    item_id: string;            // stable slug or UUID (e.g. "hat_iron_01")
    name: string;               // display name (e.g. "Iron Helm")
    description: string;        // flavour text
    category: string;           // e.g. "HELMET", "ARMOUR", "HAND_ITEM", "SHIELD", "PET", "BACKGROUND"
    rarity: ShopRarity;
    gold_cost: number;          // purchase price in gold
    required_level: number;     // minimum player level to purchase (0 = no restriction)
    is_cosmetic_only: boolean;  // true → visual only, no stat effect
    sprite_path: string;        // relative asset path (e.g. "/items/hats/iron_helm.png")
    is_active: boolean;         // false → hidden from the shop (soft-deactivated)

    // ── Gear-only fields (optional; absent on non-gear items) ─────────────────
    gender?: ShopGearGender;    // required for gear items; absent on non-gear items
    asset_key?: string;         // S3 key/path for frontend avatar rendering; required for gear items

    // ── GSI keys (computed, never set by callers directly) ────────────────────
    gsi1pk: string;             // SHOP#ACTIVE | SHOP#INACTIVE
    gsi1sk: string;             // CATEGORY#{cat}#LEVEL#{lv_3d}#PRICE#{price_6d}#RARITY#{rarity}#ITEM#{id}
    gsi2pk: string;             // CATEGORY#{cat}
    gsi2sk: string;             // LEVEL#{lv_3d}#PRICE#{price_6d}#ITEM#{id}

    // ── Timestamps ────────────────────────────────────────────────────────────
    created_at: string;         // ISO 8601
    updated_at: string;         // ISO 8601
};

/**
 * Fields the caller supplies when creating a new ShopItem.
 * All key / timestamp fields are computed by the handler.
 */
export type CreateShopItemInput = Omit<
    ShopItem,
    "item_pk" | "item_sk" | "gsi1pk" | "gsi1sk" | "gsi2pk" | "gsi2sk" | "created_at" | "updated_at"
>;

/**
 * Fields that may be changed via PATCH /shop-items/{item_id}.
 * Changing any GSI-key component (category, rarity, gold_cost, required_level)
 * causes the handler to recompute the GSI keys before writing.
 */
export type UpdateShopItemInput = Partial<
    Pick<
        ShopItem,
        | "name"
        | "description"
        | "category"
        | "rarity"
        | "gold_cost"
        | "required_level"
        | "is_cosmetic_only"
        | "sprite_path"
        | "gender"
        | "asset_key"
    >
>;

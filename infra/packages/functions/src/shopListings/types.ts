/**
 * ShopListing record stored in DynamoDB.
 *
 * Controls where, when, and how a ShopItem appears in the shop.
 * Does NOT represent inventory ownership or purchase history.
 *
 * Primary key:  PK (SHOP#GLOBAL | SHOP#CLASS#{class_id})
 *               SK (ACTIVEFROM#{available_from}#LISTING#{shop_listing_id})
 * GSI1:         GSI1PK (SHOPVIEW#GLOBAL#ACTIVE etc.) / GSI1SK (FROM#...#TO#...#ITEM#...#LISTING#...)
 * GSI2:         GSI2PK (ITEM#{item_id})               / GSI2SK (SHOP#{class|GLOBAL}#FROM#...#LISTING#...)
 * GSI3:         shop_listing_id                        — direct lookup by listing ID
 */
export type ListingStatus = "ACTIVE" | "INACTIVE";

export type ShopListing = {
    // ── Primary key ──────────────────────────────────────────────────────────
    PK: string;                         // SHOP#GLOBAL | SHOP#CLASS#{class_id}
    SK: string;                         // ACTIVEFROM#{available_from}#LISTING#{shop_listing_id}

    // ── Business fields ───────────────────────────────────────────────────────
    shop_listing_id: string;            // caller-supplied unique listing ID
    item_id: string;                    // references ShopItem.item_id
    available_from: string;             // ISO 8601 — listing window start
    available_to: string;               // ISO 8601 — listing window end
    is_active: boolean;                 // manual enable/disable flag
    listing_status: ListingStatus;      // derived: ACTIVE | INACTIVE (mirrors is_active)

    // ── Optional fields ───────────────────────────────────────────────────────
    class_id?: string;                  // set for class-specific listings; absent for global
    purchase_limit_per_student?: number; // max purchases per student (undefined = unlimited)
    created_by?: string;                // teacher/admin user ID who created this listing
    display_order?: number;             // optional display sort hint

    // ── GSI keys ─────────────────────────────────────────────────────────────
    GSI1PK: string;   // SHOPVIEW#GLOBAL#ACTIVE | SHOPVIEW#GLOBAL#INACTIVE | SHOPVIEW#CLASS#{class_id}#ACTIVE | ...
    GSI1SK: string;   // FROM#{available_from}#TO#{available_to}#ITEM#{item_id}#LISTING#{shop_listing_id}
    GSI2PK: string;   // ITEM#{item_id}
    GSI2SK: string;   // SHOP#GLOBAL#FROM#{available_from}#LISTING#{shop_listing_id} | SHOP#CLASS#{class_id}#FROM#...

    // ── Timestamps ────────────────────────────────────────────────────────────
    created_at: string;                 // ISO 8601
    updated_at: string;                 // ISO 8601
};

/**
 * Fields the caller supplies when creating a new ShopListing.
 * PK/SK, GSI keys, listing_status, and timestamps are computed by the handler.
 */
export type CreateShopListingInput = {
    shop_listing_id: string;
    item_id: string;
    available_from: string;
    available_to: string;
    is_active: boolean;
    class_id?: string;
    purchase_limit_per_student?: number;
    created_by?: string;
    display_order?: number;
};

/**
 * Mutable fields that may be changed via PUT /shop-listings/{shop_listing_id}.
 * Changing class_id or available_from triggers a PK/SK rebuild (delete + put).
 * Changing is_active triggers a GSI1PK rebuild.
 */
export type UpdateShopListingInput = Partial<{
    class_id: string | null;            // null removes class affiliation (makes it global)
    available_from: string;
    available_to: string;
    is_active: boolean;
    purchase_limit_per_student: number | null;
    display_order: number | null;
}>;

export type PaginatedShopListings = {
    items: ShopListing[];
    cursor?: string;
};

/**
 * DynamoDB key helpers for the ShopListings table.
 *
 * Access patterns:
 *   Get one listing by ID             — GSI3: shop_listing_id = "{id}" (limit 1)
 *   List global active listings        — GSI1: GSI1PK = "SHOPVIEW#GLOBAL#ACTIVE"
 *   List global inactive listings      — GSI1: GSI1PK = "SHOPVIEW#GLOBAL#INACTIVE"
 *   List class active listings         — GSI1: GSI1PK = "SHOPVIEW#CLASS#{class_id}#ACTIVE"
 *   List all listings for an item      — GSI2: GSI2PK = "ITEM#{item_id}"
 *   Admin scan all listings            — Table Scan
 */

import type { ListingStatus } from "./types.ts";

// ── Primary key helpers ───────────────────────────────────────────────────────

/**
 * PK: SHOP#GLOBAL for global listings, SHOP#CLASS#{class_id} for class-specific listings.
 */
export function buildShopListingPk(classId?: string | null): string {
    return classId ? `SHOP#CLASS#${classId}` : "SHOP#GLOBAL";
}

/**
 * SK: ACTIVEFROM#{available_from}#LISTING#{shop_listing_id}
 * Lexicographic sort by activation time within a shop bucket.
 */
export function buildShopListingSk(availableFrom: string, shopListingId: string): string {
    return `ACTIVEFROM#${availableFrom}#LISTING#${shopListingId}`;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

/**
 * Derive listing_status string from is_active boolean.
 */
export function buildShopListingStatus(isActive: boolean): ListingStatus {
    return isActive ? "ACTIVE" : "INACTIVE";
}

// ── GSI1 helpers (active/inactive shop view) ──────────────────────────────────

/**
 * GSI1PK encodes both the shop scope (global vs. class) and active state.
 *
 * Examples:
 *   buildGsi1Pk(undefined, true)            → "SHOPVIEW#GLOBAL#ACTIVE"
 *   buildGsi1Pk(undefined, false)           → "SHOPVIEW#GLOBAL#INACTIVE"
 *   buildGsi1Pk("class_123", true)          → "SHOPVIEW#CLASS#class_123#ACTIVE"
 *   buildGsi1Pk("class_123", false)         → "SHOPVIEW#CLASS#class_123#INACTIVE"
 */
export function buildGsi1Pk(classId: string | undefined | null, isActive: boolean): string {
    const status = isActive ? "ACTIVE" : "INACTIVE";
    return classId
        ? `SHOPVIEW#CLASS#${classId}#${status}`
        : `SHOPVIEW#GLOBAL#${status}`;
}

/**
 * GSI1SK encodes date range + item + listing for sort/filter.
 *
 * Format: FROM#{available_from}#TO#{available_to}#ITEM#{item_id}#LISTING#{shop_listing_id}
 */
export function buildGsi1Sk(
    availableFrom: string,
    availableTo: string,
    itemId: string,
    shopListingId: string
): string {
    return `FROM#${availableFrom}#TO#${availableTo}#ITEM#${itemId}#LISTING#${shopListingId}`;
}

// ── GSI2 helpers (item-centric lookup) ────────────────────────────────────────

/**
 * GSI2PK: ITEM#{item_id}
 * All listings for a given item, regardless of class scope or active state.
 */
export function buildGsi2Pk(itemId: string): string {
    return `ITEM#${itemId}`;
}

/**
 * GSI2SK: SHOP#GLOBAL#FROM#...#LISTING#... | SHOP#CLASS#{class_id}#FROM#...#LISTING#...
 */
export function buildGsi2Sk(
    classId: string | undefined | null,
    availableFrom: string,
    shopListingId: string
): string {
    const shopPart = classId ? `CLASS#${classId}` : "GLOBAL";
    return `SHOP#${shopPart}#FROM#${availableFrom}#LISTING#${shopListingId}`;
}

// ── Composite key builder ─────────────────────────────────────────────────────

/**
 * Build the full set of computed key and status fields for a ShopListing.
 * Call this whenever creating or updating any key-component field.
 */
export function buildAllListingKeys(params: {
    shop_listing_id: string;
    class_id?: string | null;
    item_id: string;
    available_from: string;
    available_to: string;
    is_active: boolean;
}): {
    PK: string;
    SK: string;
    listing_status: ListingStatus;
    GSI1PK: string;
    GSI1SK: string;
    GSI2PK: string;
    GSI2SK: string;
} {
    return {
        PK:             buildShopListingPk(params.class_id),
        SK:             buildShopListingSk(params.available_from, params.shop_listing_id),
        listing_status: buildShopListingStatus(params.is_active),
        GSI1PK:         buildGsi1Pk(params.class_id, params.is_active),
        GSI1SK:         buildGsi1Sk(params.available_from, params.available_to, params.item_id, params.shop_listing_id),
        GSI2PK:         buildGsi2Pk(params.item_id),
        GSI2SK:         buildGsi2Sk(params.class_id, params.available_from, params.shop_listing_id),
    };
}

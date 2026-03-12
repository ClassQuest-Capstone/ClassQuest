import { api } from "../http.js";
import type {
    ShopListing,
    CreateShopListingInput,
    UpdateShopListingInput,
    PaginatedShopListings,
    PaginationOptions,
} from "./types.js";

/**
 * Create a new shop listing
 * POST /shop-listings
 */
export function createShopListing(input: CreateShopListingInput) {
    return api<{ message: string; shop_listing_id: string }>("/shop-listings", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/**
 * Get a single shop listing by ID
 * GET /shop-listings/{shop_listing_id}
 */
export function getShopListing(shopListingId: string) {
    return api<ShopListing>(
        `/shop-listings/${encodeURIComponent(shopListingId)}`
    );
}

/**
 * List ALL shop listings regardless of scope or active state (admin/teacher)
 * GET /shop-listings
 */
export function listShopListings(options?: PaginationOptions) {
    const params = new URLSearchParams();
    if (options?.limit)  params.append("limit",  options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedShopListings>(`/shop-listings${qs ? `?${qs}` : ""}`);
}

/**
 * List manually active global shop listings
 * GET /shop-listings/active
 */
export function listActiveShopListings(options?: PaginationOptions) {
    const params = new URLSearchParams();
    if (options?.limit)  params.append("limit",  options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedShopListings>(`/shop-listings/active${qs ? `?${qs}` : ""}`);
}

/**
 * List global shop listings (supports active_only filter)
 * GET /shop-listings/global
 */
export function listGlobalShopListings(options?: PaginationOptions & { active_only?: boolean }) {
    const params = new URLSearchParams();
    if (options?.limit)  params.append("limit",  options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);
    if (options?.active_only === false) params.append("active_only", "false");

    const qs = params.toString();
    return api<PaginatedShopListings>(`/shop-listings/global${qs ? `?${qs}` : ""}`);
}

/**
 * List shop listings for a specific class (supports active_only filter)
 * GET /shop-listings/class/{class_id}
 */
export function listClassShopListings(
    classId: string,
    options?: PaginationOptions & { active_only?: boolean }
) {
    const params = new URLSearchParams();
    if (options?.limit)  params.append("limit",  options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);
    if (options?.active_only === false) params.append("active_only", "false");

    const qs = params.toString();
    return api<PaginatedShopListings>(
        `/shop-listings/class/${encodeURIComponent(classId)}${qs ? `?${qs}` : ""}`
    );
}

/**
 * List all shop listings for a given item ID (across all scopes and active states)
 * GET /shop-listings/item/{item_id}
 */
export function listShopListingsByItem(itemId: string, options?: PaginationOptions) {
    const params = new URLSearchParams();
    if (options?.limit)  params.append("limit",  options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedShopListings>(
        `/shop-listings/item/${encodeURIComponent(itemId)}${qs ? `?${qs}` : ""}`
    );
}

/**
 * Update mutable fields on a shop listing
 * PUT /shop-listings/{shop_listing_id}
 */
export function updateShopListing(shopListingId: string, input: UpdateShopListingInput) {
    return api<ShopListing>(
        `/shop-listings/${encodeURIComponent(shopListingId)}`,
        {
            method: "PUT",
            body: JSON.stringify(input),
        }
    );
}

/**
 * Activate a shop listing (set is_active = true)
 * POST /shop-listings/{shop_listing_id}/activate
 */
export function activateShopListing(shopListingId: string) {
    return api<ShopListing>(
        `/shop-listings/${encodeURIComponent(shopListingId)}/activate`,
        { method: "POST" }
    );
}

/**
 * Deactivate a shop listing (set is_active = false)
 * POST /shop-listings/{shop_listing_id}/deactivate
 */
export function deactivateShopListing(shopListingId: string) {
    return api<ShopListing>(
        `/shop-listings/${encodeURIComponent(shopListingId)}/deactivate`,
        { method: "POST" }
    );
}

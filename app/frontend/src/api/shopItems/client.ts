import { api } from "../http.js";
import type {
    ShopItem,
    CreateShopItemInput,
    UpdateShopItemInput,
    PaginatedShopItems,
    PaginationOptions,
} from "./types.js";

/**
 * Create a new shop item definition (admin/teacher)
 * POST /shop-items
 */
export function createShopItem(input: CreateShopItemInput) {
    return api<{ message: string; item_id: string }>("/shop-items", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/**
 * Get a single shop item by ID
 * GET /shop-items/{item_id}
 */
export function getShopItem(itemId: string) {
    return api<ShopItem>(`/shop-items/${encodeURIComponent(itemId)}`);
}

/**
 * List ALL shop items regardless of active status (admin/teacher)
 * GET /shop-items
 */
export function listShopItems(options?: PaginationOptions) {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedShopItems>(`/shop-items${qs ? `?${qs}` : ""}`);
}

/**
 * List all active shop items (visible to students)
 * GET /shop-items/active
 */
export function listActiveShopItems(options?: PaginationOptions) {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedShopItems>(`/shop-items/active${qs ? `?${qs}` : ""}`);
}

/**
 * List active shop items in a specific category
 * GET /shop-items/category/{category}
 */
export function listShopItemsByCategory(category: string, options?: PaginationOptions) {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedShopItems>(
        `/shop-items/category/${encodeURIComponent(category)}${qs ? `?${qs}` : ""}`
    );
}

/**
 * Update mutable fields on a shop item
 * PATCH /shop-items/{item_id}
 */
export function updateShopItem(itemId: string, input: UpdateShopItemInput) {
    return api<{ message: string; item: ShopItem }>(
        `/shop-items/${encodeURIComponent(itemId)}`,
        {
            method: "PATCH",
            body: JSON.stringify(input),
        }
    );
}

/**
 * Activate a shop item (make it visible to students)
 * PATCH /shop-items/{item_id}/activate
 */
export function activateShopItem(itemId: string) {
    return api<{ message: string; item: ShopItem }>(
        `/shop-items/${encodeURIComponent(itemId)}/activate`,
        { method: "PATCH" }
    );
}

/**
 * Deactivate a shop item (hide it from the shop)
 * PATCH /shop-items/{item_id}/deactivate
 */
export function deactivateShopItem(itemId: string) {
    return api<{ message: string; item: ShopItem }>(
        `/shop-items/${encodeURIComponent(itemId)}/deactivate`,
        { method: "PATCH" }
    );
}

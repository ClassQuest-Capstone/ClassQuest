export type ListingStatus = "ACTIVE" | "INACTIVE";

/**
 * ShopListing as returned by the API.
 * Controls where, when, and how a ShopItem appears in the shop.
 * Does NOT represent inventory ownership or purchases.
 */
export type ShopListing = {
    PK: string;
    SK: string;
    shop_listing_id: string;
    item_id: string;
    available_from: string;
    available_to: string;
    is_active: boolean;
    listing_status: ListingStatus;
    class_id?: string;
    purchase_limit_per_student?: number;
    created_by?: string;
    display_order?: number;
    GSI1PK: string;
    GSI1SK: string;
    GSI2PK: string;
    GSI2SK: string;
    created_at: string;
    updated_at: string;
};

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

export type UpdateShopListingInput = Partial<{
    class_id: string | null;
    available_from: string;
    available_to: string;
    is_active: boolean;
    purchase_limit_per_student: number | null;
    display_order: number | null;
}>;

export type PaginatedShopListings = {
    items: ShopListing[];
    cursor?: string | null;
    count: number;
};

export type PaginationOptions = {
    limit?: number;
    cursor?: string;
};

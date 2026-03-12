export type AcquiredFrom =
    | "SHOP_PURCHASE"
    | "QUEST_REWARD"
    | "BOSS_REWARD"
    | "ADMIN_GRANT"
    | "SYSTEM_MIGRATION";

/**
 * InventoryItem as returned by the API.
 * Represents a student's ownership of one item.
 * Equipment state is stored in a separate table.
 */
export type InventoryItem = {
    PK: string;
    SK: string;
    inventory_item_id: string;
    student_id: string;
    class_id: string;
    item_id: string;
    quantity: number;
    acquired_from: AcquiredFrom;
    acquired_at: string;
    updated_at: string;
    GSI1PK: string;
    GSI1SK: string;
    GSI2PK: string;
    GSI2SK: string;
};

export type CreateInventoryItemInput = {
    student_id: string;
    class_id: string;
    item_id: string;
    quantity: number;
    acquired_from: AcquiredFrom;
    acquired_at?: string;
};

export type UpdateInventoryItemInput = Partial<{
    quantity: number;
    acquired_from: AcquiredFrom;
    class_id: string;
}>;

export type GrantInventoryItemInput = {
    student_id: string;
    class_id: string;
    item_id: string;
    quantity?: number;
    acquired_from?: AcquiredFrom;
};

export type GrantInventoryItemResponse = {
    action: "created" | "incremented";
    inventory_item_id: string;
    student_id: string;
    item_id: string;
    quantity: number;
    message: string;
};

export type OwnershipCheckResult = {
    owned: boolean;
    quantity: number;
    inventory_item_id?: string;
};

export type PaginatedInventoryItems = {
    items: InventoryItem[];
    cursor?: string | null;
    count: number;
};

export type PaginationOptions = {
    limit?: number;
    cursor?: string;
};

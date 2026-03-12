/**
 * InventoryItems — ownership records only.
 *
 * One row per student + item. Tracks what a student owns and in what quantity.
 * Equipment state is stored in a separate table (not here).
 * Shop listings and purchase transactions are stored in separate tables (not here).
 *
 * Primary key:  PK (STUDENT#{student_id}) + SK (ITEM#{item_id})
 * GSI1:         GSI1PK (CLASS#{class_id}) / GSI1SK (STUDENT#{student_id}#ITEM#{item_id})
 * GSI2:         GSI2PK (ITEM#{item_id})   / GSI2SK (CLASS#{class_id}#STUDENT#{student_id})
 */

export type AcquiredFrom =
    | "SHOP_PURCHASE"
    | "QUEST_REWARD"
    | "BOSS_REWARD"
    | "ADMIN_GRANT"
    | "SYSTEM_MIGRATION";

export const ACQUIRED_FROM_VALUES: AcquiredFrom[] = [
    "SHOP_PURCHASE",
    "QUEST_REWARD",
    "BOSS_REWARD",
    "ADMIN_GRANT",
    "SYSTEM_MIGRATION",
];

export type InventoryItem = {
    // ── Primary key ──────────────────────────────────────────────────────────
    PK: string;                     // STUDENT#{student_id}
    SK: string;                     // ITEM#{item_id}

    // ── Business fields ───────────────────────────────────────────────────────
    inventory_item_id: string;      // stable record identifier (server-generated)
    student_id: string;
    class_id: string;
    item_id: string;
    quantity: number;               // >= 1; tracks count owned
    acquired_from: AcquiredFrom;    // how the item was originally acquired
    acquired_at: string;            // ISO 8601 — first acquisition timestamp

    // ── GSI keys ─────────────────────────────────────────────────────────────
    GSI1PK: string;                 // CLASS#{class_id}
    GSI1SK: string;                 // STUDENT#{student_id}#ITEM#{item_id}
    GSI2PK: string;                 // ITEM#{item_id}
    GSI2SK: string;                 // CLASS#{class_id}#STUDENT#{student_id}

    // ── Timestamps ────────────────────────────────────────────────────────────
    updated_at: string;             // ISO 8601
};

/**
 * Input for creating a new inventory ownership record.
 */
export type CreateInventoryItemInput = {
    student_id: string;
    class_id: string;
    item_id: string;
    quantity: number;
    acquired_from: AcquiredFrom;
    acquired_at?: string;           // defaults to now if not provided
};

/**
 * Input for updating an existing inventory ownership record.
 * class_id may be corrected (triggers GSI key rebuild).
 */
export type UpdateInventoryItemInput = Partial<{
    quantity: number;
    acquired_from: AcquiredFrom;
    class_id: string;
}>;

/**
 * Input for the grant endpoint (create-or-increment).
 */
export type GrantInventoryItemInput = {
    student_id: string;
    class_id: string;
    item_id: string;
    quantity?: number;              // defaults to 1
    acquired_from?: AcquiredFrom;  // defaults to ADMIN_GRANT
};

export type PaginatedInventoryItems = {
    items: InventoryItem[];
    cursor?: string;
};

export type OwnershipCheckResult = {
    owned: boolean;
    quantity: number;
    inventory_item_id?: string;
};

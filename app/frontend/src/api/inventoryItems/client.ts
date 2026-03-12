import { api } from "../http.js";
import type {
    InventoryItem,
    CreateInventoryItemInput,
    UpdateInventoryItemInput,
    GrantInventoryItemInput,
    GrantInventoryItemResponse,
    OwnershipCheckResult,
    PaginatedInventoryItems,
    PaginationOptions,
} from "./types.js";

/**
 * Create a new inventory ownership record (admin/teacher)
 * POST /inventory-items
 * Returns 409 if the student already owns the item.
 */
export function createInventoryItem(input: CreateInventoryItemInput) {
    return api<{ message: string; inventory_item_id: string; student_id: string; item_id: string }>(
        "/inventory-items",
        {
            method: "POST",
            body: JSON.stringify(input),
        }
    );
}

/**
 * Get one inventory record by student + item
 * GET /inventory-items/{student_id}/{item_id}
 */
export function getInventoryItem(studentId: string, itemId: string) {
    return api<InventoryItem>(
        `/inventory-items/${encodeURIComponent(studentId)}/${encodeURIComponent(itemId)}`
    );
}

/**
 * List all inventory items owned by a student
 * GET /inventory-items/student/{student_id}
 */
export function listStudentInventoryItems(studentId: string, options?: PaginationOptions) {
    const params = new URLSearchParams();
    if (options?.limit)  params.append("limit",  options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedInventoryItems>(
        `/inventory-items/student/${encodeURIComponent(studentId)}${qs ? `?${qs}` : ""}`
    );
}

/**
 * List inventory items for a class
 * GET /inventory-items/class/{class_id}
 */
export function listClassInventoryItems(classId: string, options?: PaginationOptions) {
    const params = new URLSearchParams();
    if (options?.limit)  params.append("limit",  options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedInventoryItems>(
        `/inventory-items/class/${encodeURIComponent(classId)}${qs ? `?${qs}` : ""}`
    );
}

/**
 * List inventory items for a specific student within a class
 * GET /inventory-items/class/{class_id}/student/{student_id}
 */
export function listClassStudentInventoryItems(
    classId: string,
    studentId: string,
    options?: PaginationOptions
) {
    const params = new URLSearchParams();
    if (options?.limit)  params.append("limit",  options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedInventoryItems>(
        `/inventory-items/class/${encodeURIComponent(classId)}/student/${encodeURIComponent(studentId)}${qs ? `?${qs}` : ""}`
    );
}

/**
 * List all students who own a given item (admin/teacher)
 * GET /inventory-items/item/{item_id}/owners
 */
export function listInventoryOwnersByItem(itemId: string, options?: PaginationOptions) {
    const params = new URLSearchParams();
    if (options?.limit)  params.append("limit",  options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedInventoryItems>(
        `/inventory-items/item/${encodeURIComponent(itemId)}/owners${qs ? `?${qs}` : ""}`
    );
}

/**
 * Update mutable fields on an inventory record (admin/teacher)
 * PUT /inventory-items/{student_id}/{item_id}
 */
export function updateInventoryItem(
    studentId: string,
    itemId: string,
    input: UpdateInventoryItemInput
) {
    return api<InventoryItem>(
        `/inventory-items/${encodeURIComponent(studentId)}/${encodeURIComponent(itemId)}`,
        {
            method: "PUT",
            body: JSON.stringify(input),
        }
    );
}

/**
 * Delete an inventory ownership record (admin/teacher)
 * DELETE /inventory-items/{student_id}/{item_id}
 */
export function deleteInventoryItem(studentId: string, itemId: string) {
    return api<{ message: string; student_id: string; item_id: string }>(
        `/inventory-items/${encodeURIComponent(studentId)}/${encodeURIComponent(itemId)}`,
        { method: "DELETE" }
    );
}

/**
 * Grant an item to a student — creates ownership or increments quantity (admin/teacher)
 * POST /inventory-items/grant
 */
export function grantInventoryItem(input: GrantInventoryItemInput) {
    return api<GrantInventoryItemResponse>("/inventory-items/grant", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/**
 * Check if a student owns a given item
 * GET /inventory-items/owns/{student_id}/{item_id}
 */
export function checkStudentOwnsItem(studentId: string, itemId: string) {
    return api<OwnershipCheckResult>(
        `/inventory-items/owns/${encodeURIComponent(studentId)}/${encodeURIComponent(itemId)}`
    );
}

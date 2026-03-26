import { api } from "../http.js";
import type {
    EquippedItems,
    CreateEquippedItemsInput,
    UpdateEquippedItemsInput,
    EquipSlotInput,
    UnequipSlotInput,
    PaginatedEquippedItems,
} from "./types.js";

/**
 * Create a new EquippedItems record for a student in a class.
 * POST /equipped-items
 */
export function createEquippedItems(input: CreateEquippedItemsInput) {
    return api<{ message: string } & EquippedItems>(
        "/equipped-items",
        { method: "POST", body: JSON.stringify(input) }
    );
}

/**
 * Get an EquippedItems record by id.
 * GET /equipped-items/{equipped_id}
 */
export function getEquippedItems(equippedId: string) {
    return api<EquippedItems>(`/equipped-items/${encodeURIComponent(equippedId)}`);
}

/**
 * Get the EquippedItems record for a specific student in a class.
 * GET /equipped-items/class/{class_id}/student/{student_id}
 */
export function getEquippedItemsByClassAndStudent(classId: string, studentId: string) {
    return api<EquippedItems>(
        `/equipped-items/class/${encodeURIComponent(classId)}/student/${encodeURIComponent(studentId)}`
    );
}

/**
 * Update mutable fields on an EquippedItems record.
 * PATCH /equipped-items/{equipped_id}
 */
export function updateEquippedItems(equippedId: string, input: UpdateEquippedItemsInput) {
    return api<EquippedItems>(
        `/equipped-items/${encodeURIComponent(equippedId)}`,
        { method: "PATCH", body: JSON.stringify(input) }
    );
}

/**
 * Equip an item in a specific slot (validates ownership and item metadata).
 * POST /equipped-items/{equipped_id}/equip
 */
export function equipItem(equippedId: string, input: EquipSlotInput) {
    return api<EquippedItems>(
        `/equipped-items/${encodeURIComponent(equippedId)}/equip`,
        { method: "POST", body: JSON.stringify(input) }
    );
}

/**
 * Unequip a slot (resets to AvatarBases default if available).
 * POST /equipped-items/{equipped_id}/unequip
 */
export function unequipItem(equippedId: string, input: UnequipSlotInput) {
    return api<EquippedItems & { unequipped_slot: string; reset_to: string | null }>(
        `/equipped-items/${encodeURIComponent(equippedId)}/unequip`,
        { method: "POST", body: JSON.stringify(input) }
    );
}

/**
 * List all EquippedItems records for a class.
 * GET /equipped-items/class/{class_id}
 */
export function listEquippedItemsByClass(
    classId: string,
    options?: { limit?: number; cursor?: string }
) {
    const params = new URLSearchParams();
    if (options?.limit)  params.append("limit",  options.limit.toString());
    if (options?.cursor) params.append("cursor",  options.cursor);

    const qs = params.toString();
    return api<PaginatedEquippedItems>(
        `/equipped-items/class/${encodeURIComponent(classId)}${qs ? `?${qs}` : ""}`
    );
}

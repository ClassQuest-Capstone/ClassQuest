/**
 * DynamoDB key helpers for the InventoryItems table.
 *
 * Access patterns:
 *   Get one record (student + item)   — PK: STUDENT#{student_id}, SK: ITEM#{item_id}
 *   List all items for a student      — PK: STUDENT#{student_id} (query, no SK condition)
 *   List class inventory              — GSI1: GSI1PK = "CLASS#{class_id}"
 *   List class inventory for student  — GSI1: GSI1PK = "CLASS#{class_id}", begins_with(GSI1SK, "STUDENT#{student_id}#")
 *   List all owners of one item       — GSI2: GSI2PK = "ITEM#{item_id}"
 */

// ── Primary key helpers ───────────────────────────────────────────────────────

/**
 * PK: STUDENT#{student_id}
 */
export function buildInventoryItemPk(studentId: string): string {
    return `STUDENT#${studentId}`;
}

/**
 * SK: ITEM#{item_id}
 */
export function buildInventoryItemSk(itemId: string): string {
    return `ITEM#${itemId}`;
}

// ── GSI1 helpers (class-level inventory browse) ────────────────────────────────

/**
 * GSI1PK: CLASS#{class_id}
 */
export function buildInventoryItemGsi1Pk(classId: string): string {
    return `CLASS#${classId}`;
}

/**
 * GSI1SK: STUDENT#{student_id}#ITEM#{item_id}
 * Supports begins_with filter to scope to a single student within a class.
 */
export function buildInventoryItemGsi1Sk(studentId: string, itemId: string): string {
    return `STUDENT#${studentId}#ITEM#${itemId}`;
}

// ── GSI2 helpers (item-centric owner lookup) ──────────────────────────────────

/**
 * GSI2PK: ITEM#{item_id}
 */
export function buildInventoryItemGsi2Pk(itemId: string): string {
    return `ITEM#${itemId}`;
}

/**
 * GSI2SK: CLASS#{class_id}#STUDENT#{student_id}
 */
export function buildInventoryItemGsi2Sk(classId: string, studentId: string): string {
    return `CLASS#${classId}#STUDENT#${studentId}`;
}

// ── Composite key builder ─────────────────────────────────────────────────────

/**
 * Build the full set of computed key fields for an InventoryItem.
 */
export function buildAllInventoryKeys(params: {
    student_id: string;
    class_id: string;
    item_id: string;
}): {
    PK: string;
    SK: string;
    GSI1PK: string;
    GSI1SK: string;
    GSI2PK: string;
    GSI2SK: string;
} {
    return {
        PK:     buildInventoryItemPk(params.student_id),
        SK:     buildInventoryItemSk(params.item_id),
        GSI1PK: buildInventoryItemGsi1Pk(params.class_id),
        GSI1SK: buildInventoryItemGsi1Sk(params.student_id, params.item_id),
        GSI2PK: buildInventoryItemGsi2Pk(params.item_id),
        GSI2SK: buildInventoryItemGsi2Sk(params.class_id, params.student_id),
    };
}

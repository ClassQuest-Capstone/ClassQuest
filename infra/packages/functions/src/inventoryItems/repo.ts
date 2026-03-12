import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
    DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { InventoryItem } from "./types.ts";
import {
    buildInventoryItemPk,
    buildInventoryItemSk,
    buildInventoryItemGsi1Pk,
    buildInventoryItemGsi1Sk,
    buildInventoryItemGsi2Pk,
    buildInventoryItemGsi2Sk,
} from "./keys.ts";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.INVENTORY_ITEMS_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing INVENTORY_ITEMS_TABLE_NAME environment variable");
}

export type PaginationCursor = string;

export type PaginatedResult<T> = {
    items: T[];
    cursor?: PaginationCursor;
};

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Write a new InventoryItem.
 * Fails with ConditionalCheckFailedException if the student already owns this item (PK+SK exists).
 */
export async function createInventoryItem(item: InventoryItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(SK)",
        })
    );
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Get one inventory record by student_id + item_id.
 * Direct PK/SK lookup — O(1).
 */
export async function getInventoryItem(
    student_id: string,
    item_id: string
): Promise<InventoryItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: {
                PK: buildInventoryItemPk(student_id),
                SK: buildInventoryItemSk(item_id),
            },
        })
    );
    return (result.Item as InventoryItem) ?? null;
}

// ── List by student ───────────────────────────────────────────────────────────

/**
 * List all inventory items for one student.
 * Queries the primary index by PK.
 */
export async function listByStudent(
    student_id: string,
    limit: number = 100,
    cursor?: PaginationCursor
): Promise<PaginatedResult<InventoryItem>> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: {
                ":pk": buildInventoryItemPk(student_id),
            },
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );
    return {
        items: (result.Items as InventoryItem[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

// ── List by class ─────────────────────────────────────────────────────────────

/**
 * List inventory items for a class, optionally filtered to a single student.
 * Uses GSI1.
 */
export async function listByClass(
    class_id: string,
    student_id?: string,
    limit: number = 100,
    cursor?: PaginationCursor
): Promise<PaginatedResult<InventoryItem>> {
    const hasStudentFilter = student_id !== undefined && student_id.length > 0;

    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: hasStudentFilter
                ? "GSI1PK = :pk AND begins_with(GSI1SK, :prefix)"
                : "GSI1PK = :pk",
            ExpressionAttributeValues: {
                ":pk": buildInventoryItemGsi1Pk(class_id),
                ...(hasStudentFilter
                    ? { ":prefix": `STUDENT#${student_id}#` }
                    : {}),
            },
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );
    return {
        items: (result.Items as InventoryItem[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

// ── List by item ──────────────────────────────────────────────────────────────

/**
 * List all students who own a given item.
 * Uses GSI2.
 */
export async function listOwnersByItem(
    item_id: string,
    limit: number = 100,
    cursor?: PaginationCursor
): Promise<PaginatedResult<InventoryItem>> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi2",
            KeyConditionExpression: "GSI2PK = :pk",
            ExpressionAttributeValues: {
                ":pk": buildInventoryItemGsi2Pk(item_id),
            },
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );
    return {
        items: (result.Items as InventoryItem[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update mutable fields on an InventoryItem.
 * If class_id changes, GSI1PK, GSI1SK, and GSI2SK are recomputed and included in the update.
 */
export async function updateInventoryItem(
    student_id: string,
    item_id: string,
    updates: {
        quantity?: number;
        acquired_from?: string;
        class_id?: string;
        // Recomputed GSI keys — provided when class_id changes
        GSI1PK?: string;
        GSI1SK?: string;
        GSI2SK?: string;
        updated_at: string;
    }
): Promise<InventoryItem> {
    const exprParts: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};

    const addField = (attr: string, value: any) => {
        exprParts.push(`#${attr} = :${attr}`);
        names[`#${attr}`] = attr;
        values[`:${attr}`] = value;
    };

    if (updates.quantity      !== undefined) addField("quantity",      updates.quantity);
    if (updates.acquired_from !== undefined) addField("acquired_from", updates.acquired_from);
    if (updates.class_id      !== undefined) addField("class_id",      updates.class_id);
    if (updates.GSI1PK        !== undefined) addField("GSI1PK",        updates.GSI1PK);
    if (updates.GSI1SK        !== undefined) addField("GSI1SK",        updates.GSI1SK);
    if (updates.GSI2SK        !== undefined) addField("GSI2SK",        updates.GSI2SK);
    addField("updated_at", updates.updated_at);

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: {
                PK: buildInventoryItemPk(student_id),
                SK: buildInventoryItemSk(item_id),
            },
            UpdateExpression: "SET " + exprParts.join(", "),
            ExpressionAttributeNames:  names,
            ExpressionAttributeValues: values,
            ConditionExpression: "attribute_exists(SK)",
            ReturnValues: "ALL_NEW",
        })
    );

    return result.Attributes as InventoryItem;
}

// ── Grant (create or increment) ───────────────────────────────────────────────

/**
 * Increment quantity by delta on an existing record.
 * Used by the grant flow when the student already owns the item.
 */
export async function incrementQuantity(
    student_id: string,
    item_id: string,
    delta: number,
    updated_at: string
): Promise<InventoryItem> {
    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: {
                PK: buildInventoryItemPk(student_id),
                SK: buildInventoryItemSk(item_id),
            },
            UpdateExpression: "SET #updated_at = :updated_at ADD #quantity :delta",
            ExpressionAttributeNames: {
                "#updated_at": "updated_at",
                "#quantity":   "quantity",
            },
            ExpressionAttributeValues: {
                ":updated_at": updated_at,
                ":delta":      delta,
            },
            ConditionExpression: "attribute_exists(SK)",
            ReturnValues: "ALL_NEW",
        })
    );
    return result.Attributes as InventoryItem;
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Permanently delete an inventory ownership record.
 * Throws ConditionalCheckFailedException if the record does not exist.
 */
export async function deleteInventoryItem(
    student_id: string,
    item_id: string
): Promise<void> {
    await ddb.send(
        new DeleteCommand({
            TableName: TABLE,
            Key: {
                PK: buildInventoryItemPk(student_id),
                SK: buildInventoryItemSk(item_id),
            },
            ConditionExpression: "attribute_exists(SK)",
        })
    );
}

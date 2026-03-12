import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    QueryCommand,
    UpdateCommand,
    DeleteCommand,
    ScanCommand,
    TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { ShopListing } from "./types.ts";
import { buildGsi1Pk, buildShopListingStatus } from "./keys.ts";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.SHOP_LISTINGS_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing SHOP_LISTINGS_TABLE_NAME environment variable");
}

export type PaginationCursor = string;

export type PaginatedResult<T> = {
    items: T[];
    cursor?: PaginationCursor;
};

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Write a new ShopListing.
 * Fails with ConditionalCheckFailedException if the (PK, SK) pair already exists.
 */
export async function createListing(listing: ShopListing): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: listing,
            ConditionExpression: "attribute_not_exists(SK)",
        })
    );
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Get a single ShopListing by its shop_listing_id.
 * Uses GSI3 (partitioned on shop_listing_id) for an efficient O(1) lookup.
 * Returns null if not found.
 */
export async function getListingById(
    shop_listing_id: string
): Promise<ShopListing | null> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi3",
            KeyConditionExpression: "shop_listing_id = :id",
            ExpressionAttributeValues: { ":id": shop_listing_id },
            Limit: 1,
        })
    );
    const items = result.Items as ShopListing[] | undefined;
    return items?.[0] ?? null;
}

// ── List by GSI1 (shop bucket view) ──────────────────────────────────────────

/**
 * List listings for a given GSI1PK bucket (global or class, active or inactive).
 */
export async function listByGsi1(
    gsi1pk: string,
    limit: number = 100,
    cursor?: PaginationCursor
): Promise<PaginatedResult<ShopListing>> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "GSI1PK = :pk",
            ExpressionAttributeValues: { ":pk": gsi1pk },
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );
    return {
        items: (result.Items as ShopListing[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

// ── List by GSI2 (item-centric) ───────────────────────────────────────────────

/**
 * List all ShopListings for a given item_id.
 * Uses GSI2 — returns listings across all scopes and active states.
 */
export async function listListingsByItem(
    item_id: string,
    limit: number = 100,
    cursor?: PaginationCursor
): Promise<PaginatedResult<ShopListing>> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi2",
            KeyConditionExpression: "GSI2PK = :pk",
            ExpressionAttributeValues: { ":pk": `ITEM#${item_id}` },
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );
    return {
        items: (result.Items as ShopListing[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

// ── Scan all (admin) ──────────────────────────────────────────────────────────

/**
 * Scan all ShopListings (admin/teacher use only).
 */
export async function scanAllListings(
    limit: number = 100,
    cursor?: PaginationCursor
): Promise<PaginatedResult<ShopListing>> {
    const result = await ddb.send(
        new ScanCommand({
            TableName: TABLE,
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );
    return {
        items: (result.Items as ShopListing[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update mutable fields that do NOT change PK or SK
 * (available_to, purchase_limit_per_student, display_order, is_active, GSI1PK).
 *
 * Use replaceListingRecord for updates that change PK or SK.
 */
export async function updateListingInPlace(
    PK: string,
    SK: string,
    updates: {
        available_to?: string;
        purchase_limit_per_student?: number | null;
        display_order?: number | null;
        is_active?: boolean;
        listing_status?: string;
        GSI1PK?: string;
        GSI1SK?: string;
        GSI2SK?: string;
        updated_at: string;
    }
): Promise<ShopListing> {
    const exprParts: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};

    const addField = (attr: string, value: any) => {
        exprParts.push(`#${attr} = :${attr}`);
        names[`#${attr}`] = attr;
        values[`:${attr}`] = value;
    };
    const removeField = (attr: string) => {
        // handled via REMOVE clause
    };

    const removeParts: string[] = [];

    if (updates.available_to   !== undefined) addField("available_to",   updates.available_to);
    if (updates.is_active      !== undefined) addField("is_active",      updates.is_active);
    if (updates.listing_status !== undefined) addField("listing_status", updates.listing_status);
    if (updates.GSI1PK         !== undefined) addField("GSI1PK",         updates.GSI1PK);
    if (updates.GSI1SK         !== undefined) addField("GSI1SK",         updates.GSI1SK);
    if (updates.GSI2SK         !== undefined) addField("GSI2SK",         updates.GSI2SK);
    addField("updated_at", updates.updated_at);

    if (updates.purchase_limit_per_student !== undefined) {
        if (updates.purchase_limit_per_student === null) {
            removeParts.push("#purchase_limit_per_student");
            names["#purchase_limit_per_student"] = "purchase_limit_per_student";
        } else {
            addField("purchase_limit_per_student", updates.purchase_limit_per_student);
        }
    }
    if (updates.display_order !== undefined) {
        if (updates.display_order === null) {
            removeParts.push("#display_order");
            names["#display_order"] = "display_order";
        } else {
            addField("display_order", updates.display_order);
        }
    }

    let updateExpression = "SET " + exprParts.join(", ");
    if (removeParts.length > 0) {
        updateExpression += " REMOVE " + removeParts.join(", ");
    }

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { PK, SK },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames:  names,
            ExpressionAttributeValues: values,
            ConditionExpression: "attribute_exists(SK)",
            ReturnValues: "ALL_NEW",
        })
    );

    return result.Attributes as ShopListing;
}

/**
 * Replace a listing record when PK or SK must change (class_id or available_from changed).
 * Uses a TransactWrite: delete the old record and put the new one atomically.
 */
export async function replaceListingRecord(
    oldPK: string,
    oldSK: string,
    newListing: ShopListing
): Promise<void> {
    await ddb.send(
        new TransactWriteCommand({
            TransactItems: [
                {
                    Delete: {
                        TableName: TABLE,
                        Key: { PK: oldPK, SK: oldSK },
                        ConditionExpression: "attribute_exists(SK)",
                    },
                },
                {
                    Put: {
                        TableName: TABLE,
                        Item: newListing,
                        ConditionExpression: "attribute_not_exists(SK)",
                    },
                },
            ],
        })
    );
}

// ── Activate / Deactivate ─────────────────────────────────────────────────────

/**
 * Toggle is_active and rebuild GSI1PK / listing_status.
 * PK/SK are unaffected.
 */
export async function setListingActiveStatus(
    PK: string,
    SK: string,
    classId: string | undefined | null,
    is_active: boolean,
    updated_at: string
): Promise<ShopListing> {
    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { PK, SK },
            UpdateExpression:
                "SET #is_active = :is_active, #listing_status = :listing_status, #GSI1PK = :GSI1PK, #updated_at = :updated_at",
            ExpressionAttributeNames: {
                "#is_active":      "is_active",
                "#listing_status": "listing_status",
                "#GSI1PK":         "GSI1PK",
                "#updated_at":     "updated_at",
            },
            ExpressionAttributeValues: {
                ":is_active":      is_active,
                ":listing_status": buildShopListingStatus(is_active),
                ":GSI1PK":         buildGsi1Pk(classId, is_active),
                ":updated_at":     updated_at,
            },
            ConditionExpression: "attribute_exists(SK)",
            ReturnValues: "ALL_NEW",
        })
    );

    return result.Attributes as ShopListing;
}

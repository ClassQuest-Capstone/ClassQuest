import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
    ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { ShopItem } from "./types.ts";
import { makeItemPk, makeItemSk, makeGsi1Pk } from "./keys.ts";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.SHOP_ITEMS_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing SHOP_ITEMS_TABLE_NAME environment variable");
}

export type PaginationCursor = string;

export type PaginatedResult<T> = {
    items: T[];
    cursor?: PaginationCursor;
};

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Write a new ShopItem.
 * Fails with ConditionalCheckFailedException if item_pk already exists.
 */
export async function createItem(item: ShopItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(item_pk)",
        })
    );
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Get a single ShopItem by its item_id.
 * Returns null if the item does not exist.
 */
export async function getItem(item_id: string): Promise<ShopItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: {
                item_pk: makeItemPk(item_id),
                item_sk: makeItemSk(),
            },
        })
    );
    return (result.Item as ShopItem) ?? null;
}

// ── List active (all categories) ──────────────────────────────────────────────

/**
 * List all active ShopItems, ordered by category → level → price → rarity.
 * Queries GSI1 with gsi1pk = "SHOP#ACTIVE".
 */
export async function listActiveItems(
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<ShopItem>> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "gsi1pk = :pk",
            ExpressionAttributeValues: {
                ":pk": makeGsi1Pk(true),
            },
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );

    return {
        items: (result.Items as ShopItem[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

// ── List active by category ───────────────────────────────────────────────────

/**
 * List active ShopItems in a specific category, ordered by level → price → rarity.
 * Queries GSI1 with gsi1pk = "SHOP#ACTIVE" and gsi1sk begins_with "CATEGORY#{category}#".
 */
export async function listActiveByCategory(
    category: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<ShopItem>> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "gsi1pk = :pk AND begins_with(gsi1sk, :prefix)",
            ExpressionAttributeValues: {
                ":pk":     makeGsi1Pk(true),
                ":prefix": `CATEGORY#${category}#`,
            },
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );

    return {
        items: (result.Items as ShopItem[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

// ── List all (admin scan) ─────────────────────────────────────────────────────

/**
 * Scan all ShopItems regardless of active/inactive status.
 * For admin/teacher use only. Uses a table scan — not suitable for high-traffic paths.
 */
export async function scanAllItems(
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<ShopItem>> {
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
        items: (result.Items as ShopItem[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update mutable fields on a ShopItem.
 * The caller is responsible for supplying recomputed GSI keys whenever
 * any GSI-key component (category, rarity, gold_cost, required_level) changes.
 *
 * Returns the full updated item (ReturnValues: ALL_NEW).
 * Throws ConditionalCheckFailedException if the item does not exist.
 */
export async function updateItem(
    item_id: string,
    updates: {
        name?: string;
        description?: string;
        category?: string;
        rarity?: string;
        gold_cost?: number;
        required_level?: number;
        is_cosmetic_only?: boolean;
        sprite_path?: string;
        gender?: string;
        asset_key?: string;
        // Recomputed GSI keys — must be provided when any indexed field changes
        gsi1pk?: string;
        gsi1sk?: string;
        gsi2pk?: string;
        gsi2sk?: string;
        updated_at: string;
    }
): Promise<ShopItem> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    const addField = (attr: string, value: any) => {
        const nameToken  = `#${attr}`;
        const valueToken = `:${attr}`;
        updateExpressions.push(`${nameToken} = ${valueToken}`);
        expressionAttributeNames[nameToken]  = attr;
        expressionAttributeValues[valueToken] = value;
    };

    if (updates.name               !== undefined) addField("name",               updates.name);
    if (updates.description        !== undefined) addField("description",        updates.description);
    if (updates.category           !== undefined) addField("category",           updates.category);
    if (updates.rarity             !== undefined) addField("rarity",             updates.rarity);
    if (updates.gold_cost          !== undefined) addField("gold_cost",          updates.gold_cost);
    if (updates.required_level     !== undefined) addField("required_level",     updates.required_level);
    if (updates.is_cosmetic_only   !== undefined) addField("is_cosmetic_only",   updates.is_cosmetic_only);
    if (updates.sprite_path        !== undefined) addField("sprite_path",        updates.sprite_path);
    if (updates.gender             !== undefined) addField("gender",             updates.gender);
    if (updates.asset_key          !== undefined) addField("asset_key",          updates.asset_key);
    if (updates.gsi1pk             !== undefined) addField("gsi1pk",             updates.gsi1pk);
    if (updates.gsi1sk             !== undefined) addField("gsi1sk",             updates.gsi1sk);
    if (updates.gsi2pk             !== undefined) addField("gsi2pk",             updates.gsi2pk);
    if (updates.gsi2sk             !== undefined) addField("gsi2sk",             updates.gsi2sk);
    addField("updated_at", updates.updated_at);

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: {
                item_pk: makeItemPk(item_id),
                item_sk: makeItemSk(),
            },
            UpdateExpression: "SET " + updateExpressions.join(", "),
            ExpressionAttributeNames:  expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: "attribute_exists(item_pk)",
            ReturnValues: "ALL_NEW",
        })
    );

    return result.Attributes as ShopItem;
}

// ── Activate / Deactivate ─────────────────────────────────────────────────────

/**
 * Toggle the is_active flag and update gsi1pk accordingly.
 * Only is_active and gsi1pk change — gsi1sk / gsi2pk / gsi2sk are unaffected.
 *
 * Returns the full updated item (ReturnValues: ALL_NEW).
 * Throws ConditionalCheckFailedException if the item does not exist.
 */
export async function setActiveStatus(
    item_id: string,
    is_active: boolean,
    updated_at: string
): Promise<ShopItem> {
    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: {
                item_pk: makeItemPk(item_id),
                item_sk: makeItemSk(),
            },
            UpdateExpression:
                "SET #is_active = :is_active, #gsi1pk = :gsi1pk, #updated_at = :updated_at",
            ExpressionAttributeNames: {
                "#is_active":  "is_active",
                "#gsi1pk":     "gsi1pk",
                "#updated_at": "updated_at",
            },
            ExpressionAttributeValues: {
                ":is_active":  is_active,
                ":gsi1pk":     makeGsi1Pk(is_active),
                ":updated_at": updated_at,
            },
            ConditionExpression: "attribute_exists(item_pk)",
            ReturnValues: "ALL_NEW",
        })
    );

    return result.Attributes as ShopItem;
}

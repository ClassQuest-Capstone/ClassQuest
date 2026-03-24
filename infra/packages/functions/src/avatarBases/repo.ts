import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
    ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { AvatarBase } from "./types.ts";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.AVATAR_BASES_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing AVATAR_BASES_TABLE_NAME environment variable");
}

export type PaginationCursor = string;

export type PaginatedResult<T> = {
    items: T[];
    cursor?: PaginationCursor;
};

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Write a new AvatarBase.
 * Fails with ConditionalCheckFailedException if avatar_base_id already exists.
 */
export async function createBase(base: AvatarBase): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: base,
            ConditionExpression: "attribute_not_exists(avatar_base_id)",
        })
    );
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Get a single AvatarBase by avatar_base_id.
 * Returns null if not found.
 */
export async function getBase(avatar_base_id: string): Promise<AvatarBase | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { avatar_base_id },
        })
    );
    return (result.Item as AvatarBase) ?? null;
}

// ── List all (scan) ───────────────────────────────────────────────────────────

/**
 * Scan all AvatarBases.
 * This is a config table with few records — a scan is acceptable.
 */
export async function listBases(
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<AvatarBase>> {
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
        items: (result.Items as AvatarBase[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

// ── List by gender (GSI1) ─────────────────────────────────────────────────────

/**
 * List AvatarBases by gender using GSI1.
 * Results are ordered by role_type (GSI1 SK).
 */
export async function listBasesByGender(
    gender: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<AvatarBase>> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "gender = :gender",
            ExpressionAttributeValues: { ":gender": gender },
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );

    return {
        items: (result.Items as AvatarBase[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update mutable fields on an AvatarBase.
 * Returns the full updated record (ReturnValues: ALL_NEW).
 * Throws ConditionalCheckFailedException if the record does not exist.
 */
export async function updateBase(
    avatar_base_id: string,
    updates: {
        gender?: string;
        role_type?: string;
        is_default?: boolean;
        default_helmet_item_id?: string;
        default_armour_item_id?: string;
        default_shield_item_id?: string;
        default_pet_item_id?: string;
        default_background_item_id?: string;
        updated_at: string;
    }
): Promise<AvatarBase> {
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

    if (updates.gender                    !== undefined) addField("gender",                    updates.gender);
    if (updates.role_type                 !== undefined) addField("role_type",                 updates.role_type);
    if (updates.is_default                !== undefined) addField("is_default",                updates.is_default);
    if (updates.default_helmet_item_id    !== undefined) addField("default_helmet_item_id",    updates.default_helmet_item_id);
    if (updates.default_armour_item_id    !== undefined) addField("default_armour_item_id",    updates.default_armour_item_id);
    if (updates.default_shield_item_id    !== undefined) addField("default_shield_item_id",    updates.default_shield_item_id);
    if (updates.default_pet_item_id       !== undefined) addField("default_pet_item_id",       updates.default_pet_item_id);
    if (updates.default_background_item_id !== undefined) addField("default_background_item_id", updates.default_background_item_id);
    addField("updated_at", updates.updated_at);

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { avatar_base_id },
            UpdateExpression: "SET " + updateExpressions.join(", "),
            ExpressionAttributeNames:  expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: "attribute_exists(avatar_base_id)",
            ReturnValues: "ALL_NEW",
        })
    );

    return result.Attributes as AvatarBase;
}

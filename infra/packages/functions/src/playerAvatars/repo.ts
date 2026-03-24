import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { PlayerAvatar } from "./types.ts";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.PLAYER_AVATARS_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing PLAYER_AVATARS_TABLE_NAME environment variable");
}

export const makeGsi1Pk = (class_id: string) => `CLASS#${class_id}`;
export const makeGsi1Sk = (student_id: string) => `STUDENT#${student_id}`;

export type PaginationCursor = string;

export type PaginatedResult<T> = {
    items: T[];
    cursor?: PaginationCursor;
};

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Write a new PlayerAvatar record.
 * Fails with ConditionalCheckFailedException if player_avatar_id already exists.
 */
export async function createAvatar(avatar: PlayerAvatar): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: avatar,
            ConditionExpression: "attribute_not_exists(player_avatar_id)",
        })
    );
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Get a PlayerAvatar by player_avatar_id.
 * Returns null if not found.
 */
export async function getAvatar(player_avatar_id: string): Promise<PlayerAvatar | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { player_avatar_id },
        })
    );
    return (result.Item as PlayerAvatar) ?? null;
}

/**
 * Get a PlayerAvatar by class_id + student_id using GSI1.
 * Returns null if not found (at most one record per student per class).
 */
export async function getAvatarByClassAndStudent(
    class_id: string,
    student_id: string
): Promise<PlayerAvatar | null> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "gsi1pk = :pk AND gsi1sk = :sk",
            ExpressionAttributeValues: {
                ":pk": makeGsi1Pk(class_id),
                ":sk": makeGsi1Sk(student_id),
            },
            Limit: 1,
        })
    );
    const items = result.Items as PlayerAvatar[];
    return items?.[0] ?? null;
}

/**
 * List all PlayerAvatars in a class using GSI1.
 */
export async function listAvatarsByClass(
    class_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<PlayerAvatar>> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "gsi1pk = :pk",
            ExpressionAttributeValues: {
                ":pk": makeGsi1Pk(class_id),
            },
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );

    return {
        items: (result.Items as PlayerAvatar[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update mutable fields on a PlayerAvatar.
 * Returns the full updated record (ReturnValues: ALL_NEW).
 * Throws ConditionalCheckFailedException if the record does not exist.
 */
export async function updateAvatar(
    player_avatar_id: string,
    updates: {
        avatar_base_id?: string;
        gender?: string;
        equipped_helmet_item_id?: string;
        equipped_armour_item_id?: string;
        equipped_shield_item_id?: string;
        equipped_pet_item_id?: string;
        equipped_background_item_id?: string;
        gsi1pk?: string;
        gsi1sk?: string;
        updated_at: string;
    }
): Promise<PlayerAvatar> {
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

    if (updates.avatar_base_id                !== undefined) addField("avatar_base_id",                updates.avatar_base_id);
    if (updates.gender                        !== undefined) addField("gender",                        updates.gender);
    if (updates.equipped_helmet_item_id       !== undefined) addField("equipped_helmet_item_id",       updates.equipped_helmet_item_id);
    if (updates.equipped_armour_item_id       !== undefined) addField("equipped_armour_item_id",       updates.equipped_armour_item_id);
    if (updates.equipped_shield_item_id       !== undefined) addField("equipped_shield_item_id",       updates.equipped_shield_item_id);
    if (updates.equipped_pet_item_id          !== undefined) addField("equipped_pet_item_id",          updates.equipped_pet_item_id);
    if (updates.equipped_background_item_id   !== undefined) addField("equipped_background_item_id",   updates.equipped_background_item_id);
    if (updates.gsi1pk                        !== undefined) addField("gsi1pk",                        updates.gsi1pk);
    if (updates.gsi1sk                        !== undefined) addField("gsi1sk",                        updates.gsi1sk);
    addField("updated_at", updates.updated_at);

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { player_avatar_id },
            UpdateExpression: "SET " + updateExpressions.join(", "),
            ExpressionAttributeNames:  expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: "attribute_exists(player_avatar_id)",
            ReturnValues: "ALL_NEW",
        })
    );

    return result.Attributes as PlayerAvatar;
}

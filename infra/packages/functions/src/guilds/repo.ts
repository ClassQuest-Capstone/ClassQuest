import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { makeGsi1Sk } from "./keys.js";
import type { GuildItem } from "./types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.GUILDS_TABLE_NAME!;
if (!TABLE) throw new Error("Missing GUILDS_TABLE_NAME");

/**
 * Create a new guild (prevents overwrites)
 */
export async function createGuild(item: GuildItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(guild_id)",
        })
    );
}

/**
 * Get a guild by guild_id
 */
export async function getGuild(guild_id: string): Promise<GuildItem | null> {
    const res = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { guild_id },
        })
    );
    return (res.Item as GuildItem) ?? null;
}

export type GuildsListResult = {
    items: GuildItem[];
    nextCursor?: string;
};

/**
 * List guilds by class with cursor-based pagination
 *
 * @param class_id - Class identifier
 * @param limit - Maximum number of items to return (default: 50, max: 100)
 * @param cursor - Base64-encoded pagination cursor from previous response
 * @returns Guild items and next cursor (if more results exist)
 */
export async function listGuildsByClass(
    class_id: string,
    limit: number = 50,
    cursor?: string
): Promise<GuildsListResult> {
    // Limit validation
    const effectiveLimit = Math.min(Math.max(1, limit), 100);

    // Decode cursor if provided
    let exclusiveStartKey: Record<string, any> | undefined;
    if (cursor) {
        try {
            exclusiveStartKey = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
        } catch (err) {
            throw new Error("Invalid cursor format");
        }
    }

    const res = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "class_id = :cid",
            ExpressionAttributeValues: { ":cid": class_id },
            Limit: effectiveLimit,
            ScanIndexForward: true,  // Chronological order (oldest first)
            ExclusiveStartKey: exclusiveStartKey,
        })
    );

    const items = (res.Items as GuildItem[]) ?? [];

    // Encode next cursor if more results exist
    let nextCursor: string | undefined;
    if (res.LastEvaluatedKey) {
        nextCursor = Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64");
    }

    return { items, nextCursor };
}

/**
 * Update guild fields (name and/or is_active)
 * Automatically updates updated_at timestamp
 */
export async function updateGuild(
    guild_id: string,
    patch: { name?: string; is_active?: boolean }
): Promise<GuildItem | null> {
    // Build update expression dynamically
    const updates: string[] = [];
    const attrNames: Record<string, string> = {};
    const attrValues: Record<string, any> = { ":updated_at": new Date().toISOString() };

    if (patch.name !== undefined) {
        updates.push("#name = :name");
        attrNames["#name"] = "name";
        attrValues[":name"] = patch.name;
    }

    if (patch.is_active !== undefined) {
        updates.push("is_active = :is_active");
        attrValues[":is_active"] = patch.is_active;
    }

    // Always update updated_at
    updates.push("updated_at = :updated_at");

    if (updates.length === 1) {
        // Only updated_at would be updated, nothing to do
        return getGuild(guild_id);
    }

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { guild_id },
            UpdateExpression: `SET ${updates.join(", ")}`,
            ExpressionAttributeNames: Object.keys(attrNames).length > 0 ? attrNames : undefined,
            ExpressionAttributeValues: attrValues,
            ConditionExpression: "attribute_exists(guild_id)",
        })
    );

    return getGuild(guild_id);
}

/**
 * Deactivate a guild (set is_active = false)
 */
export async function deactivateGuild(guild_id: string): Promise<GuildItem | null> {
    const now = new Date().toISOString();

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { guild_id },
            UpdateExpression: "SET is_active = :is_active, updated_at = :updated_at",
            ExpressionAttributeValues: {
                ":is_active": false,
                ":updated_at": now,
            },
            ConditionExpression: "attribute_exists(guild_id)",
        })
    );

    return getGuild(guild_id);
}

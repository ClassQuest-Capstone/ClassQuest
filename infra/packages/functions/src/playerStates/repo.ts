import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { makeLeaderboardSort } from "./leaderboardSort.js";
import type { PlayerStateItem } from "./types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.PLAYER_STATES_TABLE_NAME!;
if (!TABLE) throw new Error("Missing PLAYER_STATES_TABLE_NAME");

/**
 * Upsert a player state (create or update)
 * Automatically computes leaderboard_sort and updates updated_at
 */
export async function upsertPlayerState(
    item: Omit<PlayerStateItem, "leaderboard_sort" | "created_at" | "updated_at">
): Promise<void> {
    const now = new Date().toISOString();
    const leaderboard_sort = makeLeaderboardSort(item.total_xp_earned, item.student_id);

    // Check if item exists to determine if we need to set created_at
    const existing = await getPlayerState(item.class_id, item.student_id);

    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: {
                ...item,
                leaderboard_sort,
                created_at: existing?.created_at ?? now,
                updated_at: now,
            },
        })
    );
}

/**
 * Get a player state by class_id and student_id
 */
export async function getPlayerState(
    class_id: string,
    student_id: string
): Promise<PlayerStateItem | null> {
    const res = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { class_id, student_id },
        })
    );
    return (res.Item as PlayerStateItem) ?? null;
}

export type LeaderboardResult = {
    items: PlayerStateItem[];
    nextCursor?: string;
};

/**
 * Get leaderboard for a class (sorted by XP descending)
 * Uses GSI1 with cursor-based pagination
 *
 * @param class_id - Class identifier
 * @param limit - Maximum number of items to return (default: 50, max: 100)
 * @param cursor - Base64-encoded pagination cursor from previous response
 * @returns Leaderboard items and next cursor (if more results exist)
 */
export async function listLeaderboard(
    class_id: string,
    limit: number = 50,
    cursor?: string
): Promise<LeaderboardResult> {
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
            ScanIndexForward: true,  // ASC on leaderboard_sort = DESC on XP
            ExclusiveStartKey: exclusiveStartKey,
        })
    );

    const items = (res.Items as PlayerStateItem[]) ?? [];

    // Encode next cursor if more results exist
    let nextCursor: string | undefined;
    if (res.LastEvaluatedKey) {
        nextCursor = Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64");
    }

    return { items, nextCursor };
}

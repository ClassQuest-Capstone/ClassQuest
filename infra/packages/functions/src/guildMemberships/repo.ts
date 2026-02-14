import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { makeGsi1Sk, makeGsi2Sk } from "./keys.js";
import type { GuildMembershipItem } from "./types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.GUILD_MEMBERSHIPS_TABLE_NAME!;
if (!TABLE) throw new Error("Missing GUILD_MEMBERSHIPS_TABLE_NAME");

/**
 * Upsert a guild membership (idempotent by PK/SK)
 */
export async function upsertMembership(item: GuildMembershipItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
        })
    );
}

/**
 * Get a membership by class_id and student_id
 */
export async function getMembership(
    class_id: string,
    student_id: string
): Promise<GuildMembershipItem | null> {
    const res = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { class_id, student_id },
        })
    );
    return (res.Item as GuildMembershipItem) ?? null;
}

export type MembershipsListResult = {
    items: GuildMembershipItem[];
    nextCursor?: string;
};

/**
 * List members by guild (roster) with cursor-based pagination
 *
 * @param guild_id - Guild identifier
 * @param limit - Maximum number of items to return (default: 50, max: 100)
 * @param cursor - Base64-encoded pagination cursor from previous response
 * @returns Membership items and next cursor (if more results exist)
 */
export async function listMembersByGuild(
    guild_id: string,
    limit: number = 50,
    cursor?: string
): Promise<MembershipsListResult> {
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
            KeyConditionExpression: "guild_id = :gid",
            ExpressionAttributeValues: { ":gid": guild_id },
            Limit: effectiveLimit,
            ScanIndexForward: true,  // Chronological order (by joined_at)
            ExclusiveStartKey: exclusiveStartKey,
        })
    );

    const items = (res.Items as GuildMembershipItem[]) ?? [];

    // Encode next cursor if more results exist
    let nextCursor: string | undefined;
    if (res.LastEvaluatedKey) {
        nextCursor = Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64");
    }

    return { items, nextCursor };
}

/**
 * List student's guild memberships across classes with cursor-based pagination
 *
 * @param student_id - Student identifier
 * @param limit - Maximum number of items to return (default: 50, max: 100)
 * @param cursor - Base64-encoded pagination cursor from previous response
 * @returns Membership items and next cursor (if more results exist)
 */
export async function listStudentMemberships(
    student_id: string,
    limit: number = 50,
    cursor?: string
): Promise<MembershipsListResult> {
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
            IndexName: "gsi2",
            KeyConditionExpression: "student_id = :sid",
            ExpressionAttributeValues: { ":sid": student_id },
            Limit: effectiveLimit,
            ScanIndexForward: true,  // Chronological order (by joined_at)
            ExclusiveStartKey: exclusiveStartKey,
        })
    );

    const items = (res.Items as GuildMembershipItem[]) ?? [];

    // Encode next cursor if more results exist
    let nextCursor: string | undefined;
    if (res.LastEvaluatedKey) {
        nextCursor = Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64");
    }

    return { items, nextCursor };
}

/**
 * Leave a guild (set is_active=false, left_at=now)
 */
export async function leaveGuild(
    class_id: string,
    student_id: string
): Promise<GuildMembershipItem | null> {
    const now = new Date().toISOString();

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { class_id, student_id },
            UpdateExpression: "SET is_active = :is_active, left_at = :left_at, updated_at = :updated_at",
            ExpressionAttributeValues: {
                ":is_active": false,
                ":left_at": now,
                ":updated_at": now,
            },
            ConditionExpression: "attribute_exists(class_id)",
        })
    );

    return getMembership(class_id, student_id);
}

/**
 * Change guild (switch to a different guild in the same class)
 * Resets joined_at, removes left_at, sets is_active=true, recomputes GSI keys
 */
export async function changeGuild(
    class_id: string,
    student_id: string,
    newGuildId: string,
    role: string
): Promise<GuildMembershipItem | null> {
    const now = new Date().toISOString();
    const gsi1sk = makeGsi1Sk(now, student_id);
    const gsi2sk = makeGsi2Sk(now, class_id, newGuildId);

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { class_id, student_id },
            UpdateExpression:
                "SET guild_id = :guild_id, role_in_guild = :role, is_active = :is_active, " +
                "joined_at = :joined_at, updated_at = :updated_at, gsi1sk = :gsi1sk, gsi2sk = :gsi2sk " +
                "REMOVE left_at",
            ExpressionAttributeValues: {
                ":guild_id": newGuildId,
                ":role": role,
                ":is_active": true,
                ":joined_at": now,
                ":updated_at": now,
                ":gsi1sk": gsi1sk,
                ":gsi2sk": gsi2sk,
            },
            ConditionExpression: "attribute_exists(class_id)",
        })
    );

    return getMembership(class_id, student_id);
}

/**
 * Repository layer for BossBattleSnapshots
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    UpdateCommand,
    QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import {
    BossBattleSnapshot,
    SnapshotParticipant,
    CreateSnapshotInput,
} from "./types.js";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.BOSS_BATTLE_SNAPSHOTS_TABLE_NAME!;
const BOSS_INSTANCES_TABLE = process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME!;
const BOSS_PARTICIPANTS_TABLE = process.env.BOSS_BATTLE_PARTICIPANTS_TABLE_NAME!;

/**
 * Create participants snapshot
 * Captures current JOINED participants at countdown start
 */
export async function createParticipantsSnapshot(
    input: CreateSnapshotInput
): Promise<BossBattleSnapshot> {
    const { boss_instance_id, created_by_teacher_id } = input;

    // Step 1: Load BossBattleInstance
    const instanceResult = await ddb.send(
        new GetCommand({
            TableName: BOSS_INSTANCES_TABLE,
            Key: { boss_instance_id },
        })
    );

    if (!instanceResult.Item) {
        throw new Error(`BossBattleInstance ${boss_instance_id} not found`);
    }

    const instance = instanceResult.Item;

    // Guard: Require status == LOBBY (or allow COUNTDOWN start)
    if (instance.status !== "LOBBY" && instance.status !== "COUNTDOWN") {
        throw new Error(
            `Cannot create snapshot: battle status is ${instance.status}, must be LOBBY or COUNTDOWN`
        );
    }

    // Step 2: Query BossBattleParticipants with state=JOINED
    const participantsResult = await ddb.send(
        new QueryCommand({
            TableName: BOSS_PARTICIPANTS_TABLE,
            KeyConditionExpression: "boss_instance_id = :boss_instance_id",
            FilterExpression: "#state = :joined",
            ExpressionAttributeNames: {
                "#state": "state",
            },
            ExpressionAttributeValues: {
                ":boss_instance_id": boss_instance_id,
                ":joined": "JOINED",
            },
        })
    );

    const participants = participantsResult.Items || [];

    // Step 3: Build joined_students list
    const joinedStudents: SnapshotParticipant[] = participants.map((p) => ({
        student_id: p.student_id,
        guild_id: p.guild_id,
        // Optionally include display_name/username if available and allowed
        // display_name: p.display_name,
        // username: p.username,
    }));

    // Step 4: Compute joined_count and guild_counts
    const joinedCount = joinedStudents.length;
    const guildCounts: Record<string, number> = {};

    for (const participant of joinedStudents) {
        guildCounts[participant.guild_id] =
            (guildCounts[participant.guild_id] || 0) + 1;
    }

    // Step 5: Write BossBattleSnapshots item
    const snapshotId = randomUUID();
    const createdAt = new Date().toISOString();

    const snapshot: BossBattleSnapshot = {
        snapshot_id: snapshotId,
        boss_instance_id,
        class_id: instance.class_id,
        created_by_teacher_id,
        created_at: createdAt,
        joined_students: joinedStudents,
        joined_count: joinedCount,
        guild_counts: guildCounts,
        version: 1,
    };

    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: snapshot,
        })
    );

    // Step 6: Update BossBattleInstances.participants_snapshot_id
    // Conditional update: only set if not already set OR if still in LOBBY
    try {
        await ddb.send(
            new UpdateCommand({
                TableName: BOSS_INSTANCES_TABLE,
                Key: { boss_instance_id },
                UpdateExpression: "SET participants_snapshot_id = :snapshot_id, updated_at = :now",
                ConditionExpression:
                    "attribute_not_exists(participants_snapshot_id) OR #status = :lobby",
                ExpressionAttributeNames: {
                    "#status": "status",
                },
                ExpressionAttributeValues: {
                    ":snapshot_id": snapshotId,
                    ":now": createdAt,
                    ":lobby": "LOBBY",
                },
            })
        );
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            throw new Error(
                "Snapshot already exists for this battle or battle is no longer in LOBBY"
            );
        }
        throw error;
    }

    return snapshot;
}

/**
 * Get snapshot by ID
 */
export async function getSnapshot(snapshotId: string): Promise<BossBattleSnapshot | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { snapshot_id: snapshotId },
        })
    );

    return (result.Item as BossBattleSnapshot) || null;
}

/**
 * List snapshots by battle instance (GSI1) - for debugging
 */
export async function listSnapshotsByInstance(
    bossInstanceId: string,
    options?: {
        limit?: number;
        nextToken?: string;
    }
): Promise<{ items: BossBattleSnapshot[]; nextToken?: string }> {
    const params: any = {
        TableName: TABLE,
        IndexName: "gsi1",
        KeyConditionExpression: "boss_instance_id = :boss_instance_id",
        ExpressionAttributeValues: {
            ":boss_instance_id": bossInstanceId,
        },
        Limit: options?.limit || 50,
    };

    if (options?.nextToken) {
        params.ExclusiveStartKey = JSON.parse(
            Buffer.from(options.nextToken, "base64").toString("utf-8")
        );
    }

    const result = await ddb.send(new QueryCommand(params));

    const nextToken = result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
        : undefined;

    return {
        items: (result.Items as BossBattleSnapshot[]) || [],
        nextToken,
    };
}

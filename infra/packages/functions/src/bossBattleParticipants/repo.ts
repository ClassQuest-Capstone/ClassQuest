/**
 * Repository layer for BossBattleParticipants
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
    QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
    BossBattleParticipantItem,
    ParticipantState,
    JoinParticipantInput,
    UpdateAntiSpamFieldsInput,
    ListParticipantsFilter,
} from "./types.js";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.BOSS_BATTLE_PARTICIPANTS_TABLE_NAME!;

/**
 * Build GSI2 sort key: boss_instance_id#student_id
 */
function buildGsi2Sk(bossInstanceId: string, studentId: string): string {
    return `${bossInstanceId}#${studentId}`;
}

/**
 * Get a participant record
 */
export async function getParticipant(
    bossInstanceId: string,
    studentId: string
): Promise<BossBattleParticipantItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: {
                boss_instance_id: bossInstanceId,
                student_id: studentId,
            },
        })
    );

    return (result.Item as BossBattleParticipantItem) || null;
}

/**
 * Upsert participant join
 * - If record exists and state is KICKED → reject unless override
 * - Set state=JOINED, preserve joined_at if already joined, update updated_at
 */
export async function upsertParticipantJoin(
    input: JoinParticipantInput
): Promise<BossBattleParticipantItem> {
    const { boss_instance_id, student_id, class_id, guild_id } = input;

    // Check if participant already exists
    const existing = await getParticipant(boss_instance_id, student_id);

    // Reject if kicked
    if (existing && existing.state === ParticipantState.KICKED) {
        throw new Error(
            `Student ${student_id} was kicked from battle ${boss_instance_id} and cannot rejoin`
        );
    }

    const now = new Date().toISOString();
    const joined_at = existing?.joined_at || now;

    const item: BossBattleParticipantItem = {
        boss_instance_id,
        student_id,
        class_id,
        guild_id,
        state: ParticipantState.JOINED,
        joined_at,
        updated_at: now,
        is_downed: false,
        gsi2_sk: buildGsi2Sk(boss_instance_id, student_id),
        // Preserve anti-spam fields if they exist
        last_submit_at: existing?.last_submit_at,
        frozen_until: existing?.frozen_until,
        downed_at: existing?.downed_at,
    };

    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
        })
    );

    return item;
}

/**
 * Set participant state to SPECTATE
 */
export async function setParticipantSpectate(
    bossInstanceId: string,
    studentId: string
): Promise<void> {
    const now = new Date().toISOString();

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: {
                boss_instance_id: bossInstanceId,
                student_id: studentId,
            },
            UpdateExpression: "SET #state = :spectate, updated_at = :now",
            ExpressionAttributeNames: {
                "#state": "state",
            },
            ExpressionAttributeValues: {
                ":spectate": ParticipantState.SPECTATE,
                ":now": now,
            },
        })
    );
}

/**
 * Set participant state to LEFT
 */
export async function setParticipantLeft(
    bossInstanceId: string,
    studentId: string
): Promise<void> {
    const now = new Date().toISOString();

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: {
                boss_instance_id: bossInstanceId,
                student_id: studentId,
            },
            UpdateExpression: "SET #state = :left, updated_at = :now",
            ExpressionAttributeNames: {
                "#state": "state",
            },
            ExpressionAttributeValues: {
                ":left": ParticipantState.LEFT,
                ":now": now,
            },
        })
    );
}

/**
 * Kick a participant
 */
export async function kickParticipant(
    bossInstanceId: string,
    studentId: string,
    reason?: string
): Promise<void> {
    const now = new Date().toISOString();

    const updateExpressionParts = ["#state = :kicked", "updated_at = :now"];
    const attributeNames: Record<string, string> = { "#state": "state" };
    const attributeValues: Record<string, any> = {
        ":kicked": ParticipantState.KICKED,
        ":now": now,
    };

    if (reason) {
        updateExpressionParts.push("kick_reason = :reason");
        attributeValues[":reason"] = reason;
    }

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: {
                boss_instance_id: bossInstanceId,
                student_id: studentId,
            },
            UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
            ExpressionAttributeNames: attributeNames,
            ExpressionAttributeValues: attributeValues,
        })
    );
}

/**
 * Mark participant as downed
 */
export async function markParticipantDowned(
    bossInstanceId: string,
    studentId: string
): Promise<void> {
    const now = new Date().toISOString();

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: {
                boss_instance_id: bossInstanceId,
                student_id: studentId,
            },
            UpdateExpression: "SET is_downed = :true, downed_at = :now, updated_at = :now",
            ExpressionAttributeValues: {
                ":true": true,
                ":now": now,
            },
        })
    );
}

/**
 * Update anti-spam fields
 */
export async function updateAntiSpamFields(
    bossInstanceId: string,
    studentId: string,
    fields: UpdateAntiSpamFieldsInput
): Promise<void> {
    const now = new Date().toISOString();

    const updateExpressionParts: string[] = ["updated_at = :now"];
    const attributeValues: Record<string, any> = { ":now": now };

    if (fields.last_submit_at !== undefined) {
        updateExpressionParts.push("last_submit_at = :last_submit_at");
        attributeValues[":last_submit_at"] = fields.last_submit_at;
    }

    if (fields.frozen_until !== undefined) {
        updateExpressionParts.push("frozen_until = :frozen_until");
        attributeValues[":frozen_until"] = fields.frozen_until;
    }

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: {
                boss_instance_id: bossInstanceId,
                student_id: studentId,
            },
            UpdateExpression: `SET ${updateExpressionParts.join(", ")}`,
            ExpressionAttributeValues: attributeValues,
        })
    );
}

/**
 * List all participants in a battle
 * Optionally filter by state
 */
export async function listParticipants(
    bossInstanceId: string,
    filter?: ListParticipantsFilter
): Promise<BossBattleParticipantItem[]> {
    const params: any = {
        TableName: TABLE,
        KeyConditionExpression: "boss_instance_id = :boss_instance_id",
        ExpressionAttributeValues: {
            ":boss_instance_id": bossInstanceId,
        },
    };

    // Optional state filter
    if (filter?.state) {
        params.FilterExpression = "#state = :state";
        params.ExpressionAttributeNames = { "#state": "state" };
        params.ExpressionAttributeValues[":state"] = filter.state;
    }

    const result = await ddb.send(new QueryCommand(params));

    return (result.Items as BossBattleParticipantItem[]) || [];
}

/**
 * List participants by class (GSI2)
 * Useful for teacher views across all battles in a class
 */
export async function listParticipantsByClass(
    classId: string
): Promise<BossBattleParticipantItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi2",
            KeyConditionExpression: "class_id = :class_id",
            ExpressionAttributeValues: {
                ":class_id": classId,
            },
        })
    );

    return (result.Items as BossBattleParticipantItem[]) || [];
}

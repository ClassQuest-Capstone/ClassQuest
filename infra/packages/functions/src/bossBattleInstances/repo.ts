import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { BossBattleInstanceItem, UpdateBossBattleInstanceInput } from "./types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME!;
if (!TABLE) throw new Error("Missing BOSS_BATTLE_INSTANCES_TABLE_NAME");

export type PaginationCursor = string;

export type PaginatedResult<T> = {
    items: T[];
    cursor?: PaginationCursor;
};

/**
 * Create a new boss battle instance
 */
export async function createBossBattleInstance(item: BossBattleInstanceItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(boss_instance_id)",
        })
    );
}

/**
 * Get battle instance by ID
 */
export async function getBossBattleInstance(
    boss_instance_id: string
): Promise<BossBattleInstanceItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { boss_instance_id },
        })
    );
    return (result.Item as BossBattleInstanceItem) ?? null;
}

/**
 * List boss battle instances by class (GSI1)
 */
export async function listBossBattleInstancesByClass(
    class_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<BossBattleInstanceItem>> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "class_id = :class_id",
            ExpressionAttributeValues: {
                ":class_id": class_id,
            },
            ScanIndexForward: false, // Descending order (most recent first)
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );

    return {
        items: (result.Items as BossBattleInstanceItem[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * List boss battle instances by template (GSI2)
 */
export async function listBossBattleInstancesByTemplate(
    boss_template_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<BossBattleInstanceItem>> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi2",
            KeyConditionExpression: "boss_template_id = :boss_template_id",
            ExpressionAttributeValues: {
                ":boss_template_id": boss_template_id,
            },
            ScanIndexForward: false, // Descending order (most recent first)
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );

    return {
        items: (result.Items as BossBattleInstanceItem[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * Update boss battle instance
 * Supports partial updates with conditional check that instance exists
 */
export async function updateBossBattleInstance(
    boss_instance_id: string,
    updates: UpdateBossBattleInstanceInput & { updated_at: string }
): Promise<void> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Build update expression for each provided field
    if (updates.status !== undefined) {
        updateExpressions.push("#status = :status");
        expressionAttributeNames["#status"] = "status";
        expressionAttributeValues[":status"] = updates.status;
    }

    if (updates.current_boss_hp !== undefined) {
        updateExpressions.push("#current_boss_hp = :current_boss_hp");
        expressionAttributeNames["#current_boss_hp"] = "current_boss_hp";
        expressionAttributeValues[":current_boss_hp"] = updates.current_boss_hp;
    }

    if (updates.lobby_opened_at !== undefined) {
        updateExpressions.push("#lobby_opened_at = :lobby_opened_at");
        expressionAttributeNames["#lobby_opened_at"] = "lobby_opened_at";
        expressionAttributeValues[":lobby_opened_at"] = updates.lobby_opened_at;
    }

    if (updates.countdown_seconds !== undefined) {
        updateExpressions.push("#countdown_seconds = :countdown_seconds");
        expressionAttributeNames["#countdown_seconds"] = "countdown_seconds";
        expressionAttributeValues[":countdown_seconds"] = updates.countdown_seconds;
    }

    if (updates.countdown_end_at !== undefined) {
        updateExpressions.push("#countdown_end_at = :countdown_end_at");
        expressionAttributeNames["#countdown_end_at"] = "countdown_end_at";
        expressionAttributeValues[":countdown_end_at"] = updates.countdown_end_at;
    }

    if (updates.active_question_id !== undefined) {
        updateExpressions.push("#active_question_id = :active_question_id");
        expressionAttributeNames["#active_question_id"] = "active_question_id";
        expressionAttributeValues[":active_question_id"] = updates.active_question_id;
    }

    if (updates.question_started_at !== undefined) {
        updateExpressions.push("#question_started_at = :question_started_at");
        expressionAttributeNames["#question_started_at"] = "question_started_at";
        expressionAttributeValues[":question_started_at"] = updates.question_started_at;
    }

    if (updates.question_ends_at !== undefined) {
        updateExpressions.push("#question_ends_at = :question_ends_at");
        expressionAttributeNames["#question_ends_at"] = "question_ends_at";
        expressionAttributeValues[":question_ends_at"] = updates.question_ends_at;
    }

    if (updates.intermission_ends_at !== undefined) {
        updateExpressions.push("#intermission_ends_at = :intermission_ends_at");
        expressionAttributeNames["#intermission_ends_at"] = "intermission_ends_at";
        expressionAttributeValues[":intermission_ends_at"] = updates.intermission_ends_at;
    }

    if (updates.completed_at !== undefined) {
        updateExpressions.push("#completed_at = :completed_at");
        expressionAttributeNames["#completed_at"] = "completed_at";
        expressionAttributeValues[":completed_at"] = updates.completed_at;
    }

    if (updates.current_question_index !== undefined) {
        updateExpressions.push("#current_question_index = :current_question_index");
        expressionAttributeNames["#current_question_index"] = "current_question_index";
        expressionAttributeValues[":current_question_index"] = updates.current_question_index;
    }

    if (updates.per_guild_question_index !== undefined) {
        updateExpressions.push("#per_guild_question_index = :per_guild_question_index");
        expressionAttributeNames["#per_guild_question_index"] = "per_guild_question_index";
        expressionAttributeValues[":per_guild_question_index"] = updates.per_guild_question_index;
    }

    if (updates.active_guild_id !== undefined) {
        updateExpressions.push("#active_guild_id = :active_guild_id");
        expressionAttributeNames["#active_guild_id"] = "active_guild_id";
        expressionAttributeValues[":active_guild_id"] = updates.active_guild_id;
    }

    if (updates.outcome !== undefined) {
        updateExpressions.push("#outcome = :outcome");
        expressionAttributeNames["#outcome"] = "outcome";
        expressionAttributeValues[":outcome"] = updates.outcome;
    }

    if (updates.fail_reason !== undefined) {
        updateExpressions.push("#fail_reason = :fail_reason");
        expressionAttributeNames["#fail_reason"] = "fail_reason";
        expressionAttributeValues[":fail_reason"] = updates.fail_reason;
    }

    if (updates.participants_snapshot_id !== undefined) {
        updateExpressions.push("#participants_snapshot_id = :participants_snapshot_id");
        expressionAttributeNames["#participants_snapshot_id"] = "participants_snapshot_id";
        expressionAttributeValues[":participants_snapshot_id"] = updates.participants_snapshot_id;
    }

    if (updates.question_plan_id !== undefined) {
        updateExpressions.push("#question_plan_id = :question_plan_id");
        expressionAttributeNames["#question_plan_id"] = "question_plan_id";
        expressionAttributeValues[":question_plan_id"] = updates.question_plan_id;
    }

    if (updates.guild_question_plan_id !== undefined) {
        updateExpressions.push("#guild_question_plan_id = :guild_question_plan_id");
        expressionAttributeNames["#guild_question_plan_id"] = "guild_question_plan_id";
        expressionAttributeValues[":guild_question_plan_id"] = updates.guild_question_plan_id;
    }

    // Always set updated_at
    updateExpressions.push("#updated_at = :updated_at");
    expressionAttributeNames["#updated_at"] = "updated_at";
    expressionAttributeValues[":updated_at"] = updates.updated_at;

    if (updateExpressions.length === 0) {
        return; // Nothing to update
    }

    const updateExpression = "SET " + updateExpressions.join(", ");

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { boss_instance_id },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: "attribute_exists(boss_instance_id)",
        })
    );
}

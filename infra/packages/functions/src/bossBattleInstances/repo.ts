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

/**
 * Conditionally transition a boss battle instance from LOBBY -> COUNTDOWN.
 *
 * Called as the final atomic step in the StartCountdown orchestration, after
 * the participants snapshot and question plan have already been written.
 * The ConditionExpression enforces status=LOBBY so concurrent calls cannot
 * both succeed.
 *
 * Returns the fully-updated item (ALL_NEW).
 */
export async function startBossBattleCountdown(
    boss_instance_id: string,
    countdown_end_at: string,
    updated_at: string
): Promise<BossBattleInstanceItem> {
    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { boss_instance_id },
            UpdateExpression:
                "SET #status = :countdown, #countdown_end_at = :countdown_end_at, #updated_at = :updated_at",
            ExpressionAttributeNames: {
                "#status": "status",
                "#countdown_end_at": "countdown_end_at",
                "#updated_at": "updated_at",
            },
            ExpressionAttributeValues: {
                ":countdown": "COUNTDOWN",
                ":countdown_end_at": countdown_end_at,
                ":updated_at": updated_at,
                ":lobby": "LOBBY",
            },
            ConditionExpression: "attribute_exists(boss_instance_id) AND #status = :lobby",
            ReturnValues: "ALL_NEW",
        })
    );
    return result.Attributes as BossBattleInstanceItem;
}

/**
 * Conditionally transition a boss battle instance into QUESTION_ACTIVE.
 *
 * Allowed entry states: COUNTDOWN, INTERMISSION.
 * The ConditionExpression enforces one of these two states so concurrent
 * duplicate calls cannot both succeed.
 *
 * Handles optional fields:
 *   - active_guild_id  — only set for TURN_BASED_GUILD
 *   - question_ends_at — SET when timed, REMOVE when untimed
 *
 * Returns the fully-updated item (ALL_NEW).
 */
export async function startBossBattleQuestion(
    boss_instance_id: string,
    params: {
        active_question_id: string;
        active_guild_id?: string;
        question_started_at: string;
        question_ends_at: string | null;
        updated_at: string;
        // Answer-gating quorum state (initialized fresh each question)
        required_answer_count?: number;
        received_answer_count?: number;
        ready_to_resolve?: boolean;
        per_guild_required_answer_count?: Record<string, number>;
        per_guild_received_answer_count?: Record<string, number>;
        per_guild_ready_to_resolve?: Record<string, boolean>;
    }
): Promise<BossBattleInstanceItem> {
    const setExpressions: string[] = [
        "#status = :question_active",
        "#active_question_id = :active_question_id",
        "#question_started_at = :question_started_at",
        "#updated_at = :updated_at",
    ];
    const removeExpressions: string[] = [];
    const names: Record<string, string> = {
        "#status": "status",
        "#active_question_id": "active_question_id",
        "#question_started_at": "question_started_at",
        "#updated_at": "updated_at",
    };
    const values: Record<string, any> = {
        ":question_active": "QUESTION_ACTIVE",
        ":active_question_id": params.active_question_id,
        ":question_started_at": params.question_started_at,
        ":updated_at": params.updated_at,
        ":countdown": "COUNTDOWN",
        ":intermission": "INTERMISSION",
    };

    if (params.active_guild_id !== undefined) {
        setExpressions.push("#active_guild_id = :active_guild_id");
        names["#active_guild_id"] = "active_guild_id";
        values[":active_guild_id"] = params.active_guild_id;
    }

    if (params.question_ends_at !== null) {
        setExpressions.push("#question_ends_at = :question_ends_at");
        names["#question_ends_at"] = "question_ends_at";
        values[":question_ends_at"] = params.question_ends_at;
    } else {
        removeExpressions.push("#question_ends_at");
        names["#question_ends_at"] = "question_ends_at";
    }

    // Quorum initialization fields
    if (params.required_answer_count !== undefined) {
        setExpressions.push("#required_answer_count = :required_answer_count");
        names["#required_answer_count"] = "required_answer_count";
        values[":required_answer_count"] = params.required_answer_count;
    }
    if (params.received_answer_count !== undefined) {
        setExpressions.push("#received_answer_count = :received_answer_count");
        names["#received_answer_count"] = "received_answer_count";
        values[":received_answer_count"] = params.received_answer_count;
    }
    if (params.ready_to_resolve !== undefined) {
        setExpressions.push("#ready_to_resolve = :ready_to_resolve");
        names["#ready_to_resolve"] = "ready_to_resolve";
        values[":ready_to_resolve"] = params.ready_to_resolve;
    }
    if (params.per_guild_required_answer_count !== undefined) {
        setExpressions.push("#per_guild_required_answer_count = :per_guild_required_answer_count");
        names["#per_guild_required_answer_count"] = "per_guild_required_answer_count";
        values[":per_guild_required_answer_count"] = params.per_guild_required_answer_count;
    }
    if (params.per_guild_received_answer_count !== undefined) {
        setExpressions.push("#per_guild_received_answer_count = :per_guild_received_answer_count");
        names["#per_guild_received_answer_count"] = "per_guild_received_answer_count";
        values[":per_guild_received_answer_count"] = params.per_guild_received_answer_count;
    }
    if (params.per_guild_ready_to_resolve !== undefined) {
        setExpressions.push("#per_guild_ready_to_resolve = :per_guild_ready_to_resolve");
        names["#per_guild_ready_to_resolve"] = "per_guild_ready_to_resolve";
        values[":per_guild_ready_to_resolve"] = params.per_guild_ready_to_resolve;
    }

    let updateExpression = "SET " + setExpressions.join(", ");
    if (removeExpressions.length > 0) {
        updateExpression += " REMOVE " + removeExpressions.join(", ");
    }

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { boss_instance_id },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ConditionExpression:
                "attribute_exists(boss_instance_id) AND (#status = :countdown OR #status = :intermission)",
            ReturnValues: "ALL_NEW",
        })
    );
    return result.Attributes as BossBattleInstanceItem;
}

/**
 * Atomically finalize a boss battle from a finishable state (INTERMISSION | RESOLVING).
 *
 * Sets status → COMPLETED with outcome/fail_reason/completed_at, and REMOVEs all
 * stale runtime fields. The ConditionExpression prevents double-finishing and
 * concurrent duplicate calls.
 *
 * Returns the fully-updated item (ALL_NEW).
 */
export async function finishBattle(
    boss_instance_id: string,
    params: {
        outcome: "WIN" | "FAIL";
        fail_reason?: "ALL_GUILDS_DOWN" | "OUT_OF_QUESTIONS" | "ABORTED_BY_TEACHER";
        completed_at: string;
        updated_at: string;
    }
): Promise<BossBattleInstanceItem> {
    const setExpressions: string[] = [
        "#status = :completed",
        "#outcome = :outcome",
        "#completed_at = :completed_at",
        "#updated_at = :updated_at",
    ];
    const removeExpressions: string[] = [
        "#active_question_id",
        "#question_started_at",
        "#question_ends_at",
        "#active_guild_id",
        "#intermission_ends_at",
    ];
    const names: Record<string, string> = {
        "#status": "status",
        "#outcome": "outcome",
        "#completed_at": "completed_at",
        "#updated_at": "updated_at",
        "#active_question_id": "active_question_id",
        "#question_started_at": "question_started_at",
        "#question_ends_at": "question_ends_at",
        "#active_guild_id": "active_guild_id",
        "#intermission_ends_at": "intermission_ends_at",
    };
    const values: Record<string, any> = {
        ":completed": "COMPLETED",
        ":outcome": params.outcome,
        ":completed_at": params.completed_at,
        ":updated_at": params.updated_at,
        ":intermission": "INTERMISSION",
        ":resolving": "RESOLVING",
    };

    if (params.fail_reason !== undefined) {
        setExpressions.push("#fail_reason = :fail_reason");
        names["#fail_reason"] = "fail_reason";
        values[":fail_reason"] = params.fail_reason;
    }

    const updateExpression =
        "SET " + setExpressions.join(", ") +
        " REMOVE " + removeExpressions.join(", ");

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { boss_instance_id },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ConditionExpression:
                "attribute_exists(boss_instance_id) AND (#status = :intermission OR #status = :resolving)",
            ReturnValues: "ALL_NEW",
        })
    );
    return result.Attributes as BossBattleInstanceItem;
}

/**
 * Atomically advance the battle to the next question position after ResolveQuestion.
 *
 * Requires `status = INTERMISSION` — the conditional guard ensures only one
 * concurrent AdvanceToNextQuestion call can succeed.
 *
 * Always REMOVEs stale runtime fields (active_question_id, question_started_at,
 * question_ends_at, active_guild_id) to prevent stale UI state before next StartQuestion.
 *
 * Returns the fully-updated item (ALL_NEW).
 */
export async function advanceToNextQuestion(
    boss_instance_id: string,
    params: {
        next_question_index?: number;
        next_per_guild_question_index?: Record<string, number>;
        next_status: "INTERMISSION" | "COMPLETED";
        outcome?: "FAIL";
        fail_reason?: "OUT_OF_QUESTIONS";
        completed_at?: string;
        updated_at: string;
    }
): Promise<BossBattleInstanceItem> {
    const setExpressions: string[] = [
        "#status = :next_status",
        "#updated_at = :updated_at",
    ];
    const removeExpressions: string[] = [
        "#active_question_id",
        "#question_started_at",
        "#question_ends_at",
        "#active_guild_id",
        // Clear stale answer-gating state from the previous question
        "#required_answer_count",
        "#received_answer_count",
        "#ready_to_resolve",
        "#per_guild_required_answer_count",
        "#per_guild_received_answer_count",
        "#per_guild_ready_to_resolve",
    ];
    const names: Record<string, string> = {
        "#status": "status",
        "#updated_at": "updated_at",
        "#active_question_id": "active_question_id",
        "#question_started_at": "question_started_at",
        "#question_ends_at": "question_ends_at",
        "#active_guild_id": "active_guild_id",
        "#required_answer_count": "required_answer_count",
        "#received_answer_count": "received_answer_count",
        "#ready_to_resolve": "ready_to_resolve",
        "#per_guild_required_answer_count": "per_guild_required_answer_count",
        "#per_guild_received_answer_count": "per_guild_received_answer_count",
        "#per_guild_ready_to_resolve": "per_guild_ready_to_resolve",
    };
    const values: Record<string, any> = {
        ":next_status": params.next_status,
        ":updated_at": params.updated_at,
        ":intermission": "INTERMISSION",
    };

    if (params.next_question_index !== undefined) {
        setExpressions.push("#current_question_index = :next_question_index");
        names["#current_question_index"] = "current_question_index";
        values[":next_question_index"] = params.next_question_index;
    }

    if (params.next_per_guild_question_index !== undefined) {
        setExpressions.push("#per_guild_question_index = :next_per_guild");
        names["#per_guild_question_index"] = "per_guild_question_index";
        values[":next_per_guild"] = params.next_per_guild_question_index;
    }

    if (params.outcome !== undefined) {
        setExpressions.push("#outcome = :outcome");
        names["#outcome"] = "outcome";
        values[":outcome"] = params.outcome;
    }

    if (params.fail_reason !== undefined) {
        setExpressions.push("#fail_reason = :fail_reason");
        names["#fail_reason"] = "fail_reason";
        values[":fail_reason"] = params.fail_reason;
    }

    if (params.completed_at !== undefined) {
        setExpressions.push("#completed_at = :completed_at");
        names["#completed_at"] = "completed_at";
        values[":completed_at"] = params.completed_at;
    }

    const updateExpression =
        "SET " + setExpressions.join(", ") +
        " REMOVE " + removeExpressions.join(", ");

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { boss_instance_id },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ConditionExpression:
                "attribute_exists(boss_instance_id) AND #status = :intermission",
            ReturnValues: "ALL_NEW",
        })
    );
    return result.Attributes as BossBattleInstanceItem;
}

/**
 * Atomically resolve the active question on a boss battle instance.
 *
 * Requires `status = QUESTION_ACTIVE` — the conditional guard ensures only
 * one concurrent ResolveQuestion call can succeed. Subsequent calls receive
 * ConditionalCheckFailedException.
 *
 * Sets status → INTERMISSION or COMPLETED, applies new boss HP, and
 * optionally sets outcome / fail_reason / intermission_ends_at.
 *
 * Returns the fully-updated item (ALL_NEW).
 */
export async function resolveQuestion(
    boss_instance_id: string,
    params: {
        new_boss_hp: number;
        next_status: "INTERMISSION" | "COMPLETED";
        outcome?: "WIN" | "FAIL";
        fail_reason?: "ALL_GUILDS_DOWN";
        intermission_ends_at?: string;
        updated_at: string;
    }
): Promise<BossBattleInstanceItem> {
    const setExpressions: string[] = [
        "#status = :next_status",
        "#current_boss_hp = :new_boss_hp",
        "#updated_at = :updated_at",
    ];
    const names: Record<string, string> = {
        "#status": "status",
        "#current_boss_hp": "current_boss_hp",
        "#updated_at": "updated_at",
    };
    const values: Record<string, any> = {
        ":next_status": params.next_status,
        ":new_boss_hp": params.new_boss_hp,
        ":updated_at": params.updated_at,
        ":question_active": "QUESTION_ACTIVE",
    };

    if (params.outcome !== undefined) {
        setExpressions.push("#outcome = :outcome");
        names["#outcome"] = "outcome";
        values[":outcome"] = params.outcome;
    }

    if (params.fail_reason !== undefined) {
        setExpressions.push("#fail_reason = :fail_reason");
        names["#fail_reason"] = "fail_reason";
        values[":fail_reason"] = params.fail_reason;
    }

    if (params.intermission_ends_at !== undefined) {
        setExpressions.push("#intermission_ends_at = :intermission_ends_at");
        names["#intermission_ends_at"] = "intermission_ends_at";
        values[":intermission_ends_at"] = params.intermission_ends_at;
    }

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { boss_instance_id },
            UpdateExpression: "SET " + setExpressions.join(", "),
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ConditionExpression:
                "attribute_exists(boss_instance_id) AND #status = :question_active",
            ReturnValues: "ALL_NEW",
        })
    );
    return result.Attributes as BossBattleInstanceItem;
}

/**
 * Atomically increment answer quorum counters for the active question.
 *
 * For SIMULTANEOUS_ALL / TURN_BASED_GUILD:
 *   ADD received_answer_count :one
 *
 * For RANDOMIZED_PER_GUILD:
 *   Also SET per_guild_received_answer_count.{guild_id} += 1
 *
 * Returns ALL_NEW so the caller can check whether the quorum threshold is reached.
 */
export async function incrementAnswerCount(
    boss_instance_id: string,
    params: {
        mode: string;
        guild_id?: string;
    }
): Promise<BossBattleInstanceItem> {
    let updateExpression: string;
    const names: Record<string, string> = {};
    const values: Record<string, any> = { ":one": 1 };

    if (params.mode === "RANDOMIZED_PER_GUILD" && params.guild_id) {
        names["#pgrac"] = "per_guild_received_answer_count";
        names["#gid"] = params.guild_id;
        values[":zero"] = 0;
        updateExpression =
            "SET #pgrac.#gid = if_not_exists(#pgrac.#gid, :zero) + :one " +
            "ADD received_answer_count :one";
    } else {
        updateExpression = "ADD received_answer_count :one";
    }

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { boss_instance_id },
            UpdateExpression: updateExpression,
            ...(Object.keys(names).length > 0 ? { ExpressionAttributeNames: names } : {}),
            ExpressionAttributeValues: values,
            ReturnValues: "ALL_NEW",
        })
    );
    return result.Attributes as BossBattleInstanceItem;
}

/**
 * Set ready_to_resolve = true on a boss battle instance.
 * For RANDOMIZED_PER_GUILD, also sets per_guild_ready_to_resolve.{guild_id} = true.
 */
export async function setReadyToResolve(
    boss_instance_id: string,
    params: { guild_id?: string } = {}
): Promise<void> {
    const setExpressions: string[] = ["ready_to_resolve = :true"];
    const names: Record<string, string> = {};
    const values: Record<string, any> = { ":true": true };

    if (params.guild_id) {
        setExpressions.push("#pgrtr.#gid = :true");
        names["#pgrtr"] = "per_guild_ready_to_resolve";
        names["#gid"] = params.guild_id;
    }

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { boss_instance_id },
            UpdateExpression: "SET " + setExpressions.join(", "),
            ...(Object.keys(names).length > 0 ? { ExpressionAttributeNames: names } : {}),
            ExpressionAttributeValues: values,
        })
    );
}

/**
 * Conditionally transition a boss battle instance from DRAFT -> LOBBY.
 *
 * The ConditionExpression enforces that status is currently DRAFT so that
 * concurrent duplicate StartBattle calls cannot both succeed — only the
 * first one wins; the second receives ConditionalCheckFailedException.
 *
 * Returns the fully-updated item (ALL_NEW).
 */
export async function startBossBattleInstance(
    boss_instance_id: string,
    lobby_opened_at: string,
    updated_at: string
): Promise<BossBattleInstanceItem> {
    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { boss_instance_id },
            UpdateExpression:
                "SET #status = :lobby, #lobby_opened_at = :lobby_opened_at, #updated_at = :updated_at",
            ExpressionAttributeNames: {
                "#status": "status",
                "#lobby_opened_at": "lobby_opened_at",
                "#updated_at": "updated_at",
            },
            ExpressionAttributeValues: {
                ":lobby": "LOBBY",
                ":lobby_opened_at": lobby_opened_at,
                ":updated_at": updated_at,
                ":draft": "DRAFT",
            },
            ConditionExpression: "attribute_exists(boss_instance_id) AND #status = :draft",
            ReturnValues: "ALL_NEW",
        })
    );
    return result.Attributes as BossBattleInstanceItem;
}

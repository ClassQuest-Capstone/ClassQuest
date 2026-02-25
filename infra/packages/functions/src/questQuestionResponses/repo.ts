import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import { QuestQuestionResponseItem, ResponseStatus, RewardStatus } from "./types.js";
import { makeInstanceStudentPk } from "./keys.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.QUEST_QUESTION_RESPONSES_TABLE_NAME!;
if (!TABLE) throw new Error("Missing QUEST_QUESTION_RESPONSES_TABLE_NAME");

export type PaginationCursor = string;

export type PaginatedResult<T> = {
    items: T[];
    cursor?: PaginationCursor;
};

/**
 * Upsert a response (idempotent by PK/SK).
 * If the response already exists, it will be overwritten.
 */
export async function upsertResponse(item: QuestQuestionResponseItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
        })
    );
}

/**
 * Get a specific response by quest_instance_id, student_id, and question_id
 */
export async function getResponse(
    quest_instance_id: string,
    student_id: string,
    question_id: string
): Promise<QuestQuestionResponseItem | null> {
    const instance_student_pk = makeInstanceStudentPk(quest_instance_id, student_id);

    const res = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { instance_student_pk, question_id },
        })
    );
    return (res.Item as QuestQuestionResponseItem) ?? null;
}

/**
 * List all responses for a quest instance (GSI1)
 */
export async function listByInstance(
    quest_instance_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<QuestQuestionResponseItem>> {
    const res = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "quest_instance_id = :qid",
            ExpressionAttributeValues: { ":qid": quest_instance_id },
            Limit: limit,
            ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : undefined,
        })
    );

    return {
        items: (res.Items as QuestQuestionResponseItem[]) ?? [],
        cursor: res.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * List all responses by a student (GSI2)
 */
export async function listByStudent(
    student_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<QuestQuestionResponseItem>> {
    const res = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi2",
            KeyConditionExpression: "student_id = :sid",
            ExpressionAttributeValues: { ":sid": student_id },
            Limit: limit,
            ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : undefined,
        })
    );

    return {
        items: (res.Items as QuestQuestionResponseItem[]) ?? [],
        cursor: res.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * List all responses for a specific question (GSI3)
 */
export async function listByQuestion(
    question_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<QuestQuestionResponseItem>> {
    const res = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi3",
            KeyConditionExpression: "question_id = :qid",
            ExpressionAttributeValues: { ":qid": question_id },
            Limit: limit,
            ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : undefined,
        })
    );

    return {
        items: (res.Items as QuestQuestionResponseItem[]) ?? [],
        cursor: res.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * Grade a response (teacher fields + reward fields)
 */
export async function gradeResponse(
    quest_instance_id: string,
    student_id: string,
    question_id: string,
    patch: {
        teacher_points_awarded?: number;
        teacher_comment?: string;
        graded_by_teacher_id?: string;
        status?: ResponseStatus;
        xp_awarded_total?: number;
        gold_awarded_total?: number;
        reward_status?: RewardStatus;
    }
): Promise<void> {
    const instance_student_pk = makeInstanceStudentPk(quest_instance_id, student_id);
    const now = new Date().toISOString();

    const updateExpressions: string[] = ["graded_at = :graded_at"];
    const expressionAttributeValues: Record<string, any> = {
        ":graded_at": now,
    };

    if (patch.teacher_points_awarded !== undefined) {
        updateExpressions.push("teacher_points_awarded = :points");
        expressionAttributeValues[":points"] = patch.teacher_points_awarded;
    }

    if (patch.teacher_comment !== undefined) {
        updateExpressions.push("teacher_comment = :comment");
        expressionAttributeValues[":comment"] = patch.teacher_comment;
    }

    if (patch.graded_by_teacher_id !== undefined) {
        updateExpressions.push("graded_by_teacher_id = :teacher_id");
        expressionAttributeValues[":teacher_id"] = patch.graded_by_teacher_id;
    }

    if (patch.status !== undefined) {
        updateExpressions.push("#status = :status");
        expressionAttributeValues[":status"] = patch.status;
    }

    if (patch.xp_awarded_total !== undefined) {
        updateExpressions.push("xp_awarded_total = :xp");
        expressionAttributeValues[":xp"] = patch.xp_awarded_total;
    }

    if (patch.gold_awarded_total !== undefined) {
        updateExpressions.push("gold_awarded_total = :gold");
        expressionAttributeValues[":gold"] = patch.gold_awarded_total;
    }

    if (patch.reward_status !== undefined) {
        updateExpressions.push("reward_status = :reward_status");
        expressionAttributeValues[":reward_status"] = patch.reward_status;
    }

    const expressionAttributeNames: Record<string, string> = {};
    if (patch.status !== undefined) {
        expressionAttributeNames["#status"] = "status";
    }

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { instance_student_pk, question_id },
            UpdateExpression: `SET ${updateExpressions.join(", ")}`,
            ExpressionAttributeValues: expressionAttributeValues,
            ...(Object.keys(expressionAttributeNames).length > 0 && { ExpressionAttributeNames: expressionAttributeNames }),
            ConditionExpression: "attribute_exists(instance_student_pk)",
        })
    );
}

/**
 * Query responses for a specific student within an instance.
 * Uses the primary key directly (instance_student_pk).
 */
export async function listByInstanceAndStudent(
    quest_instance_id: string,
    student_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<QuestQuestionResponseItem>> {
    const instance_student_pk = makeInstanceStudentPk(quest_instance_id, student_id);

    const res = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            KeyConditionExpression: "instance_student_pk = :pk",
            ExpressionAttributeValues: { ":pk": instance_student_pk },
            Limit: limit,
            ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : undefined,
        })
    );

    return {
        items: (res.Items as QuestQuestionResponseItem[]) ?? [],
        cursor: res.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * Mark a response reward as applied
 * Internal route for reward pipeline - sets reward_txn_id and reward_status
 */
export async function markRewardApplied(
    quest_instance_id: string,
    student_id: string,
    question_id: string,
    reward_txn_id: string,
    xp_awarded_total: number,
    gold_awarded_total: number
): Promise<void> {
    const instance_student_pk = makeInstanceStudentPk(quest_instance_id, student_id);

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { instance_student_pk, question_id },
            UpdateExpression: "SET reward_txn_id = :txn_id, reward_status = :status, xp_awarded_total = :xp, gold_awarded_total = :gold",
            ExpressionAttributeValues: {
                ":txn_id": reward_txn_id,
                ":status": RewardStatus.APPLIED,
                ":xp": xp_awarded_total,
                ":gold": gold_awarded_total,
            },
            // Only update if not already applied with same txn_id (idempotency)
            ConditionExpression: "attribute_exists(instance_student_pk) AND (attribute_not_exists(reward_txn_id) OR reward_txn_id <> :txn_id)",
        })
    );
}

/**
 * Mark a response reward as reversed
 * Internal route for reward pipeline - updates reward_status to REVERSED
 */
export async function markRewardReversed(
    quest_instance_id: string,
    student_id: string,
    question_id: string,
    reward_txn_id: string
): Promise<void> {
    const instance_student_pk = makeInstanceStudentPk(quest_instance_id, student_id);

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { instance_student_pk, question_id },
            UpdateExpression: "SET reward_status = :status",
            ExpressionAttributeValues: {
                ":status": RewardStatus.REVERSED,
                ":txn_id": reward_txn_id,
            },
            // Only update if reward_txn_id matches
            ConditionExpression: "attribute_exists(instance_student_pk) AND reward_txn_id = :txn_id",
        })
    );
}

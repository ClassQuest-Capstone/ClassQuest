import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    UpdateCommand,
    QueryCommand,
    TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
    QuestAnswerAttemptItem,
    buildQuestAttemptPK,
    buildAttemptSK,
    buildGSIKeys,
    buildCounterPK,
} from "./types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.QUEST_ANSWER_ATTEMPTS_TABLE_NAME!;
if (!TABLE) throw new Error("Missing QUEST_ANSWER_ATTEMPTS_TABLE_NAME");

export type PaginationCursor = string;

export type PaginatedResult<T> = {
    items: T[];
    cursor?: PaginationCursor;
};

/**
 * Allocate next attempt number using atomic counter + transactional write
 * This ensures no two attempts get the same attempt_no
 */
export async function allocateAttemptNo(
    quest_instance_id: string,
    student_id: string,
    question_id: string
): Promise<number> {
    const counterPK = buildCounterPK(quest_instance_id, student_id, question_id);

    // Use UpdateCommand with ADD to atomically increment counter
    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: {
                quest_attempt_pk: counterPK,
                attempt_sk: "COUNTER", // Fixed SK for counter items
            },
            UpdateExpression: "ADD next_attempt_no :inc",
            ExpressionAttributeValues: {
                ":inc": 1,
            },
            ReturnValues: "UPDATED_NEW",
        })
    );

    const nextAttemptNo = result.Attributes?.next_attempt_no as number;
    if (!nextAttemptNo) {
        throw new Error("Failed to allocate attempt_no");
    }

    return nextAttemptNo;
}

/**
 * Put a new attempt (assumes attempt_no already allocated)
 */
export async function putAttempt(item: QuestAnswerAttemptItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
        })
    );
}

/**
 * Create attempt with atomic counter allocation
 */
export async function createAttemptWithCounter(
    quest_instance_id: string,
    student_id: string,
    question_id: string,
    answer_raw: string,
    answer_normalized: string | undefined,
    created_at: string
): Promise<QuestAnswerAttemptItem> {
    // Allocate attempt number
    const attempt_no = await allocateAttemptNo(quest_instance_id, student_id, question_id);

    // Build keys
    const quest_attempt_pk = buildQuestAttemptPK(quest_instance_id, student_id, question_id);
    const attempt_sk = buildAttemptSK(attempt_no, created_at);
    const gsiKeys = buildGSIKeys(quest_instance_id, student_id, question_id, attempt_no, created_at);

    // Build item
    const item: QuestAnswerAttemptItem = {
        quest_attempt_pk,
        attempt_sk,
        quest_instance_id,
        student_id,
        question_id,
        attempt_no,
        answer_raw,
        answer_normalized,
        created_at,
        ...gsiKeys,
    };

    // Put item
    await putAttempt(item);

    return item;
}

/**
 * Query attempts by PK (quest_instance, student, question)
 */
export async function queryByPK(
    quest_instance_id: string,
    student_id: string,
    question_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<QuestAnswerAttemptItem>> {
    const quest_attempt_pk = buildQuestAttemptPK(quest_instance_id, student_id, question_id);

    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            KeyConditionExpression: "quest_attempt_pk = :pk AND begins_with(attempt_sk, :sk_prefix)",
            ExpressionAttributeValues: {
                ":pk": quest_attempt_pk,
                ":sk_prefix": "A#", // Filter out counter items
            },
            ScanIndexForward: false, // Descending order (most recent first)
            Limit: limit,
            ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : undefined,
        })
    );

    return {
        items: (result.Items as QuestAnswerAttemptItem[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * Query attempts by GSI1 (student attempts within quest instance)
 */
export async function queryByGSI1(
    quest_instance_id: string,
    student_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<QuestAnswerAttemptItem>> {
    const gsi1_pk = `S#${student_id}#QI#${quest_instance_id}`;

    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "gsi1_pk = :pk",
            ExpressionAttributeValues: {
                ":pk": gsi1_pk,
            },
            ScanIndexForward: false, // Descending order (most recent first)
            Limit: limit,
            ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : undefined,
        })
    );

    return {
        items: (result.Items as QuestAnswerAttemptItem[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * Query attempts by GSI2 (question analytics within quest instance)
 */
export async function queryByGSI2(
    quest_instance_id: string,
    question_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<QuestAnswerAttemptItem>> {
    const gsi2_pk = `QI#${quest_instance_id}#Q#${question_id}`;

    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi2",
            KeyConditionExpression: "gsi2_pk = :pk",
            ExpressionAttributeValues: {
                ":pk": gsi2_pk,
            },
            ScanIndexForward: false, // Descending order (most recent first)
            Limit: limit,
            ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : undefined,
        })
    );

    return {
        items: (result.Items as QuestAnswerAttemptItem[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * Update attempt grading fields
 */
export async function updateAttemptGrade(
    quest_instance_id: string,
    student_id: string,
    question_id: string,
    attempt_no: number,
    gradeData: {
        is_correct?: boolean;
        grader_type?: string;
        auto_grade_result?: string;
        teacher_grade_status?: string;
        graded_at: string;
        xp_awarded?: number;
        gold_awarded?: number;
        reward_txn_id?: string;
    }
): Promise<void> {
    const quest_attempt_pk = buildQuestAttemptPK(quest_instance_id, student_id, question_id);

    // We need to find the attempt_sk. Since we have attempt_no, we need to query first
    // to get the exact attempt_sk (which includes the created_at timestamp)
    const attempts = await queryByPK(quest_instance_id, student_id, question_id);
    const targetAttempt = attempts.items.find(item => item.attempt_no === attempt_no);

    if (!targetAttempt) {
        throw new Error(`Attempt #${attempt_no} not found`);
    }

    // Build update expression dynamically
    const updateParts: string[] = [];
    const attributeNames: Record<string, string> = {};
    const attributeValues: Record<string, any> = {};

    if (gradeData.is_correct !== undefined) {
        updateParts.push("#is_correct = :is_correct");
        attributeNames["#is_correct"] = "is_correct";
        attributeValues[":is_correct"] = gradeData.is_correct;
    }

    if (gradeData.grader_type) {
        updateParts.push("grader_type = :grader_type");
        attributeValues[":grader_type"] = gradeData.grader_type;
    }

    if (gradeData.auto_grade_result) {
        updateParts.push("auto_grade_result = :auto_grade_result");
        attributeValues[":auto_grade_result"] = gradeData.auto_grade_result;
    }

    if (gradeData.teacher_grade_status) {
        updateParts.push("teacher_grade_status = :teacher_grade_status");
        attributeValues[":teacher_grade_status"] = gradeData.teacher_grade_status;
    }

    if (gradeData.graded_at) {
        updateParts.push("graded_at = :graded_at");
        attributeValues[":graded_at"] = gradeData.graded_at;
    }

    if (gradeData.xp_awarded !== undefined) {
        updateParts.push("xp_awarded = :xp_awarded");
        attributeValues[":xp_awarded"] = gradeData.xp_awarded;
    }

    if (gradeData.gold_awarded !== undefined) {
        updateParts.push("gold_awarded = :gold_awarded");
        attributeValues[":gold_awarded"] = gradeData.gold_awarded;
    }

    if (gradeData.reward_txn_id) {
        updateParts.push("reward_txn_id = :reward_txn_id");
        attributeValues[":reward_txn_id"] = gradeData.reward_txn_id;
    }

    if (updateParts.length === 0) {
        throw new Error("No grading fields to update");
    }

    const updateExpression = `SET ${updateParts.join(", ")}`;

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: {
                quest_attempt_pk,
                attempt_sk: targetAttempt.attempt_sk,
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: Object.keys(attributeNames).length > 0 ? attributeNames : undefined,
            ExpressionAttributeValues: attributeValues,
        })
    );
}

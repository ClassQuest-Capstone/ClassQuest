/**
 * Repository layer for BossAnswerAttempts
 * Append-only combat log - no updates allowed
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { BossAnswerAttemptItem, CreateBossAnswerAttemptInput } from "./types.js";
import {
    buildBossAttemptPk,
    buildAttemptSk,
    buildGsi2Sk,
    buildGsi3Pk,
    buildGsi3Sk,
} from "./keys.js";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.BOSS_ANSWER_ATTEMPTS_TABLE_NAME!;

/**
 * Create a new boss answer attempt (append-only)
 */
export async function createBossAnswerAttempt(
    input: CreateBossAnswerAttemptInput
): Promise<BossAnswerAttemptItem> {
    const answeredAt = new Date().toISOString();

    const item: BossAnswerAttemptItem = {
        boss_attempt_pk: buildBossAttemptPk(input.boss_instance_id, input.question_id),
        attempt_sk: buildAttemptSk(answeredAt, input.student_id),
        boss_instance_id: input.boss_instance_id,
        class_id: input.class_id,
        question_id: input.question_id,
        student_id: input.student_id,
        guild_id: input.guild_id,
        answer_raw: input.answer_raw,
        is_correct: input.is_correct,
        answered_at: answeredAt,
        elapsed_seconds: input.elapsed_seconds,
        effective_time_limit_seconds: input.effective_time_limit_seconds,
        speed_multiplier: input.speed_multiplier,
        damage_to_boss: input.damage_to_boss,
        hearts_delta_student: input.hearts_delta_student,
        hearts_delta_guild_total: input.hearts_delta_guild_total,
        mode_type: input.mode_type,
        status_at_submit: input.status_at_submit,
        reward_txn_id: input.reward_txn_id,
        auto_grade_result: input.auto_grade_result,
        // GSI keys
        gsi2_sk: buildGsi2Sk(answeredAt, input.boss_instance_id, input.question_id),
        gsi3_pk: buildGsi3Pk(input.boss_instance_id, input.student_id),
        gsi3_sk: buildGsi3Sk(answeredAt, input.question_id),
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
 * List all attempts by battle (GSI1)
 * Sorted by answered_at ascending
 */
export async function listAttemptsByBattle(
    bossInstanceId: string,
    options?: {
        limit?: number;
        nextToken?: string;
    }
): Promise<{ items: BossAnswerAttemptItem[]; nextToken?: string }> {
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
        items: (result.Items as BossAnswerAttemptItem[]) || [],
        nextToken,
    };
}

/**
 * List all attempts by student (GSI2)
 * Sorted by answered_at ascending
 */
export async function listAttemptsByStudent(
    studentId: string,
    options?: {
        limit?: number;
        nextToken?: string;
    }
): Promise<{ items: BossAnswerAttemptItem[]; nextToken?: string }> {
    const params: any = {
        TableName: TABLE,
        IndexName: "gsi2",
        KeyConditionExpression: "student_id = :student_id",
        ExpressionAttributeValues: {
            ":student_id": studentId,
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
        items: (result.Items as BossAnswerAttemptItem[]) || [],
        nextToken,
    };
}

/**
 * List attempts by battle + student (GSI3)
 * Teacher drilldown for specific student in a battle
 */
export async function listAttemptsByBattleStudent(
    bossInstanceId: string,
    studentId: string,
    options?: {
        limit?: number;
        nextToken?: string;
    }
): Promise<{ items: BossAnswerAttemptItem[]; nextToken?: string }> {
    const params: any = {
        TableName: TABLE,
        IndexName: "gsi3",
        KeyConditionExpression: "gsi3_pk = :gsi3_pk",
        ExpressionAttributeValues: {
            ":gsi3_pk": buildGsi3Pk(bossInstanceId, studentId),
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
        items: (result.Items as BossAnswerAttemptItem[]) || [],
        nextToken,
    };
}

/**
 * List attempts for a specific battle question (PK query)
 * Used for resolve/aggregation
 */
export async function listAttemptsByBattleQuestion(
    bossInstanceId: string,
    questionId: string,
    options?: {
        limit?: number;
        nextToken?: string;
    }
): Promise<{ items: BossAnswerAttemptItem[]; nextToken?: string }> {
    const params: any = {
        TableName: TABLE,
        KeyConditionExpression: "boss_attempt_pk = :pk",
        ExpressionAttributeValues: {
            ":pk": buildBossAttemptPk(bossInstanceId, questionId),
        },
        Limit: options?.limit || 100,
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
        items: (result.Items as BossAnswerAttemptItem[]) || [],
        nextToken,
    };
}

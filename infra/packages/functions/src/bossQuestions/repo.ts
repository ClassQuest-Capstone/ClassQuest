import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
    DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { BossQuestionItem } from "./types.ts";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.BOSS_QUESTIONS_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing BOSS_QUESTIONS_TABLE_NAME environment variable");
}

export type PaginationCursor = string;

export type PaginatedResult<T> = {
    items: T[];
    cursor?: PaginationCursor;
};

/**
 * Create a new boss question
 * Conditional write ensures question_id is unique
 */
export async function createQuestion(item: BossQuestionItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(question_id)",
        })
    );
}

/**
 * Get question by primary key
 */
export async function getQuestion(
    question_id: string
): Promise<BossQuestionItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { question_id },
        })
    );
    return (result.Item as BossQuestionItem) ?? null;
}

/**
 * List all questions for a boss template, ordered by order_key
 * Query gsi1 by boss_template_id with pagination support
 */
export async function listByTemplate(
    boss_template_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<BossQuestionItem>> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "boss_template_id = :tid",
            ExpressionAttributeValues: {
                ":tid": boss_template_id,
            },
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
            // Questions are automatically sorted by order_key (SK)
        })
    );

    return {
        items: (result.Items as BossQuestionItem[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * Update question fields
 * If order_index changes, caller must provide new order_key
 */
export async function updateQuestion(
    question_id: string,
    updates: {
        order_index?: number;
        order_key?: string;
        question_text?: string;
        question_type?: string;
        options?: any;
        correct_answer?: any;
        damage_to_boss_on_correct?: number;
        damage_to_guild_on_incorrect?: number;
        max_points?: number;
        auto_gradable?: boolean;
        updated_at?: string;
    }
): Promise<void> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Build update expression for each provided field
    if (updates.order_index !== undefined) {
        updateExpressions.push("#order_index = :order_index");
        expressionAttributeNames["#order_index"] = "order_index";
        expressionAttributeValues[":order_index"] = updates.order_index;
    }

    if (updates.order_key !== undefined) {
        updateExpressions.push("#order_key = :order_key");
        expressionAttributeNames["#order_key"] = "order_key";
        expressionAttributeValues[":order_key"] = updates.order_key;
    }

    if (updates.question_text !== undefined) {
        updateExpressions.push("#question_text = :question_text");
        expressionAttributeNames["#question_text"] = "question_text";
        expressionAttributeValues[":question_text"] = updates.question_text;
    }

    if (updates.question_type !== undefined) {
        updateExpressions.push("#question_type = :question_type");
        expressionAttributeNames["#question_type"] = "question_type";
        expressionAttributeValues[":question_type"] = updates.question_type;
    }

    if (updates.options !== undefined) {
        updateExpressions.push("#options = :options");
        expressionAttributeNames["#options"] = "options";
        expressionAttributeValues[":options"] = updates.options;
    }

    if (updates.correct_answer !== undefined) {
        updateExpressions.push("#correct_answer = :correct_answer");
        expressionAttributeNames["#correct_answer"] = "correct_answer";
        expressionAttributeValues[":correct_answer"] = updates.correct_answer;
    }

    if (updates.damage_to_boss_on_correct !== undefined) {
        updateExpressions.push("#damage_to_boss_on_correct = :damage_to_boss_on_correct");
        expressionAttributeNames["#damage_to_boss_on_correct"] = "damage_to_boss_on_correct";
        expressionAttributeValues[":damage_to_boss_on_correct"] = updates.damage_to_boss_on_correct;
    }

    if (updates.damage_to_guild_on_incorrect !== undefined) {
        updateExpressions.push("#damage_to_guild_on_incorrect = :damage_to_guild_on_incorrect");
        expressionAttributeNames["#damage_to_guild_on_incorrect"] = "damage_to_guild_on_incorrect";
        expressionAttributeValues[":damage_to_guild_on_incorrect"] = updates.damage_to_guild_on_incorrect;
    }

    if (updates.max_points !== undefined) {
        updateExpressions.push("#max_points = :max_points");
        expressionAttributeNames["#max_points"] = "max_points";
        expressionAttributeValues[":max_points"] = updates.max_points;
    }

    if (updates.auto_gradable !== undefined) {
        updateExpressions.push("#auto_gradable = :auto_gradable");
        expressionAttributeNames["#auto_gradable"] = "auto_gradable";
        expressionAttributeValues[":auto_gradable"] = updates.auto_gradable;
    }

    if (updates.updated_at !== undefined) {
        updateExpressions.push("#updated_at = :updated_at");
        expressionAttributeNames["#updated_at"] = "updated_at";
        expressionAttributeValues[":updated_at"] = updates.updated_at;
    }

    if (updateExpressions.length === 0) {
        return; // Nothing to update
    }

    const updateExpression = "SET " + updateExpressions.join(", ");

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { question_id },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: "attribute_exists(question_id)",
        })
    );
}

/**
 * Delete a boss question
 */
export async function deleteQuestion(question_id: string): Promise<void> {
    await ddb.send(
        new DeleteCommand({
            TableName: TABLE,
            Key: { question_id },
        })
    );
}

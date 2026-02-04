import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
    DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { QuestQuestionItem } from "./types.ts";

// Initialize DynamoDB client
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.QUEST_QUESTIONS_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing QUEST_QUESTIONS_TABLE_NAME environment variable");
}

/**
 * Create a new question
 * Conditional write ensures question_id is unique
 */
export async function createQuestion(item: QuestQuestionItem): Promise<void> {
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
): Promise<QuestQuestionItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { question_id },
        })
    );
    return (result.Item as QuestQuestionItem) ?? null;
}

/**
 * List all questions for a quest template, ordered by order_key
 * Query gsi1 by quest_template_id
 */
export async function listByTemplate(
    quest_template_id: string
): Promise<QuestQuestionItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "quest_template_id = :tid",
            ExpressionAttributeValues: {
                ":tid": quest_template_id,
            },
            // Questions are automatically sorted by order_key (SK)
        })
    );

    return (result.Items as QuestQuestionItem[]) ?? [];
}

/**
 * Update question fields
 */
export async function updateQuestion(
    question_id: string,
    updates: {
        order_index?: number;
        order_key?: string;
        question_format?: string;
        question_type?: string;
        prompt?: string;
        options?: any;
        correct_answer?: any;
        max_points?: number;
        auto_gradable?: boolean;
        rubric_text?: string;
        difficulty?: string;
        hint?: string;
        explanation?: string;
        time_limit_seconds?: number;
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

    if (updates.question_format !== undefined) {
        updateExpressions.push("#question_format = :question_format");
        expressionAttributeNames["#question_format"] = "question_format";
        expressionAttributeValues[":question_format"] = updates.question_format;
    }

    if (updates.question_type !== undefined) {
        updateExpressions.push("#question_type = :question_type");
        expressionAttributeNames["#question_type"] = "question_type";
        expressionAttributeValues[":question_type"] = updates.question_type;
    }

    if (updates.prompt !== undefined) {
        updateExpressions.push("#prompt = :prompt");
        expressionAttributeNames["#prompt"] = "prompt";
        expressionAttributeValues[":prompt"] = updates.prompt;
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

    if (updates.rubric_text !== undefined) {
        updateExpressions.push("#rubric_text = :rubric_text");
        expressionAttributeNames["#rubric_text"] = "rubric_text";
        expressionAttributeValues[":rubric_text"] = updates.rubric_text;
    }

    if (updates.difficulty !== undefined) {
        updateExpressions.push("#difficulty = :difficulty");
        expressionAttributeNames["#difficulty"] = "difficulty";
        expressionAttributeValues[":difficulty"] = updates.difficulty;
    }

    if (updates.hint !== undefined) {
        updateExpressions.push("#hint = :hint");
        expressionAttributeNames["#hint"] = "hint";
        expressionAttributeValues[":hint"] = updates.hint;
    }

    if (updates.explanation !== undefined) {
        updateExpressions.push("#explanation = :explanation");
        expressionAttributeNames["#explanation"] = "explanation";
        expressionAttributeValues[":explanation"] = updates.explanation;
    }

    if (updates.time_limit_seconds !== undefined) {
        updateExpressions.push("#time_limit_seconds = :time_limit_seconds");
        expressionAttributeNames["#time_limit_seconds"] = "time_limit_seconds";
        expressionAttributeValues[":time_limit_seconds"] = updates.time_limit_seconds;
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
 * Delete a question
 */
export async function deleteQuestion(question_id: string): Promise<void> {
    await ddb.send(
        new DeleteCommand({
            TableName: TABLE,
            Key: { question_id },
        })
    );
}

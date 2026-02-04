import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { QuestTemplateItem } from "./types.ts";

// Initialize DynamoDB client
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.QUEST_TEMPLATES_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing QUEST_TEMPLATES_TABLE_NAME environment variable");
}

/**
 * Create a new quest template
 * Conditional write ensures quest_template_id is unique
 */
export async function createTemplate(item: QuestTemplateItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(quest_template_id)",
        })
    );
}

/**
 * Get quest template by primary key
 */
export async function getTemplate(
    quest_template_id: string
): Promise<QuestTemplateItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { quest_template_id },
        })
    );
    return (result.Item as QuestTemplateItem) ?? null;
}

/**
 * List all templates created by a teacher
 * Query gsi1 by owner_teacher_id
 */
export async function listByOwner(
    owner_teacher_id: string
): Promise<QuestTemplateItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "owner_teacher_id = :tid",
            ExpressionAttributeValues: {
                ":tid": owner_teacher_id,
            },
        })
    );

    return (result.Items as QuestTemplateItem[]) ?? [];
}

/**
 * List public templates with optional filtering
 * Query gsi2 by visibility_pk="PUBLIC" with begins_with on public_sort
 *
 * Filters can be applied by constructing a prefix:
 * - subject only: "Mathematics#"
 * - subject + grade: "Mathematics#6#"
 * - subject + grade + difficulty: "Mathematics#6#EASY#"
 */
export async function listPublic(options?: {
    subject?: string;
    grade?: number;
    difficulty?: string;
    limit?: number;
}): Promise<QuestTemplateItem[]> {
    const { subject, grade, difficulty, limit = 100 } = options ?? {};

    // Build prefix for begins_with filtering
    let prefix = "";
    if (subject) {
        prefix += `${subject}#`;
        if (grade !== undefined) {
            prefix += `${grade}#`;
            if (difficulty) {
                prefix += `${difficulty}#`;
            }
        }
    }

    const params: any = {
        TableName: TABLE,
        IndexName: "gsi2",
        KeyConditionExpression: "visibility_pk = :vpk",
        ExpressionAttributeValues: {
            ":vpk": "PUBLIC",
        },
        Limit: limit,
    };

    // Add begins_with filter if prefix is provided
    if (prefix) {
        params.KeyConditionExpression += " AND begins_with(public_sort, :prefix)";
        params.ExpressionAttributeValues[":prefix"] = prefix;
    }

    const result = await ddb.send(new QueryCommand(params));

    return (result.Items as QuestTemplateItem[]) ?? [];
}

/**
 * Update quest template fields
 * Updates editable fields and sets updated_at timestamp
 */
export async function updateTemplate(
    quest_template_id: string,
    updates: {
        title?: string;
        description?: string;
        subject?: string;
        estimated_duration_minutes?: number;
        base_xp_reward?: number;
        base_gold_reward?: number;
        is_shared_publicly?: boolean;
        type?: string;
        grade?: number;
        difficulty?: string;
        visibility_pk?: string;
        public_sort?: string;
    }
): Promise<void> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Always update the updated_at timestamp
    updateExpressions.push("#updated_at = :updated_at");
    expressionAttributeNames["#updated_at"] = "updated_at";
    expressionAttributeValues[":updated_at"] = new Date().toISOString();

    // Build update expression for each provided field
    if (updates.title !== undefined) {
        updateExpressions.push("#title = :title");
        expressionAttributeNames["#title"] = "title";
        expressionAttributeValues[":title"] = updates.title;
    }

    if (updates.description !== undefined) {
        updateExpressions.push("#description = :description");
        expressionAttributeNames["#description"] = "description";
        expressionAttributeValues[":description"] = updates.description;
    }

    if (updates.subject !== undefined) {
        updateExpressions.push("#subject = :subject");
        expressionAttributeNames["#subject"] = "subject";
        expressionAttributeValues[":subject"] = updates.subject;
    }

    if (updates.estimated_duration_minutes !== undefined) {
        updateExpressions.push("#estimated_duration_minutes = :duration");
        expressionAttributeNames["#estimated_duration_minutes"] = "estimated_duration_minutes";
        expressionAttributeValues[":duration"] = updates.estimated_duration_minutes;
    }

    if (updates.base_xp_reward !== undefined) {
        updateExpressions.push("#base_xp_reward = :xp");
        expressionAttributeNames["#base_xp_reward"] = "base_xp_reward";
        expressionAttributeValues[":xp"] = updates.base_xp_reward;
    }

    if (updates.base_gold_reward !== undefined) {
        updateExpressions.push("#base_gold_reward = :gold");
        expressionAttributeNames["#base_gold_reward"] = "base_gold_reward";
        expressionAttributeValues[":gold"] = updates.base_gold_reward;
    }

    if (updates.is_shared_publicly !== undefined) {
        updateExpressions.push("#is_shared_publicly = :is_shared");
        expressionAttributeNames["#is_shared_publicly"] = "is_shared_publicly";
        expressionAttributeValues[":is_shared"] = updates.is_shared_publicly;
    }

    if (updates.type !== undefined) {
        updateExpressions.push("#type = :type");
        expressionAttributeNames["#type"] = "type";
        expressionAttributeValues[":type"] = updates.type;
    }

    if (updates.grade !== undefined) {
        updateExpressions.push("#grade = :grade");
        expressionAttributeNames["#grade"] = "grade";
        expressionAttributeValues[":grade"] = updates.grade;
    }

    if (updates.difficulty !== undefined) {
        updateExpressions.push("#difficulty = :difficulty");
        expressionAttributeNames["#difficulty"] = "difficulty";
        expressionAttributeValues[":difficulty"] = updates.difficulty;
    }

    // Update derived fields for GSI2 if needed
    if (updates.visibility_pk !== undefined) {
        updateExpressions.push("#visibility_pk = :visibility_pk");
        expressionAttributeNames["#visibility_pk"] = "visibility_pk";
        expressionAttributeValues[":visibility_pk"] = updates.visibility_pk;
    }

    if (updates.public_sort !== undefined) {
        updateExpressions.push("#public_sort = :public_sort");
        expressionAttributeNames["#public_sort"] = "public_sort";
        expressionAttributeValues[":public_sort"] = updates.public_sort;
    }

    const updateExpression = "SET " + updateExpressions.join(", ");

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { quest_template_id },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: "attribute_exists(quest_template_id)",
        })
    );
}

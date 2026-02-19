import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { BossBattleTemplateItem } from "./types.ts";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.BOSS_BATTLE_TEMPLATES_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing BOSS_BATTLE_TEMPLATES_TABLE_NAME environment variable");
}

export type PaginationCursor = string;

export type PaginatedResult<T> = {
    items: T[];
    cursor?: PaginationCursor;
};

/**
 * Create a new boss battle template
 * Conditional write ensures boss_template_id is unique
 */
export async function createTemplate(item: BossBattleTemplateItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: {
                ...item,
                // Store boolean as string "true" or "false" for GSI2 partition key
                is_shared_publicly: item.is_shared_publicly ? "true" : "false",
            },
            ConditionExpression: "attribute_not_exists(boss_template_id)",
        })
    );
}

/**
 * Get template by primary key
 */
export async function getTemplate(
    boss_template_id: string
): Promise<BossBattleTemplateItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { boss_template_id },
        })
    );

    if (!result.Item) {
        return null;
    }

    // Convert string back to boolean
    return {
        ...result.Item,
        is_shared_publicly: result.Item.is_shared_publicly === "true",
    } as BossBattleTemplateItem;
}

/**
 * List all templates owned by a teacher
 * Query gsi1 by owner_teacher_id
 */
export async function listByOwner(
    owner_teacher_id: string
): Promise<BossBattleTemplateItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "owner_teacher_id = :oid",
            ExpressionAttributeValues: {
                ":oid": owner_teacher_id,
            },
        })
    );

    const items = (result.Items ?? []) as any[];
    return items.map(item => ({
        ...item,
        is_shared_publicly: item.is_shared_publicly === "true",
    })) as BossBattleTemplateItem[];
}

/**
 * List public templates with optional subject filter and pagination
 * Query gsi2 by is_shared_publicly=true with optional subject prefix
 */
export async function listPublic(options?: {
    subjectPrefix?: string;
    limit?: number;
    cursor?: PaginationCursor;
}): Promise<PaginatedResult<BossBattleTemplateItem>> {
    const { subjectPrefix, limit, cursor } = options ?? {};

    // Build key condition expression
    let keyConditionExpression = "is_shared_publicly = :is_public";
    const expressionAttributeValues: Record<string, any> = {
        ":is_public": "true",
    };

    // Add subject prefix filter if provided
    if (subjectPrefix) {
        keyConditionExpression += " AND begins_with(public_sort, :subject_prefix)";
        expressionAttributeValues[":subject_prefix"] = `${subjectPrefix}#`;
    }

    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi2",
            KeyConditionExpression: keyConditionExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            Limit: limit,
            ExclusiveStartKey: cursor
                ? JSON.parse(Buffer.from(cursor, "base64").toString())
                : undefined,
        })
    );

    const items = (result.Items ?? []) as any[];
    return {
        items: items.map(item => ({
            ...item,
            is_shared_publicly: item.is_shared_publicly === "true",
        })) as BossBattleTemplateItem[],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * Update template fields
 * If subject changes, caller must provide new public_sort
 */
export async function updateTemplate(
    boss_template_id: string,
    updates: {
        title?: string;
        description?: string;
        subject?: string;
        max_hp?: number;
        base_xp_reward?: number;
        base_gold_reward?: number;
        is_shared_publicly?: boolean;
        public_sort?: string;
        updated_at?: string;
    }
): Promise<void> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

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

    if (updates.max_hp !== undefined) {
        updateExpressions.push("#max_hp = :max_hp");
        expressionAttributeNames["#max_hp"] = "max_hp";
        expressionAttributeValues[":max_hp"] = updates.max_hp;
    }

    if (updates.base_xp_reward !== undefined) {
        updateExpressions.push("#base_xp_reward = :base_xp_reward");
        expressionAttributeNames["#base_xp_reward"] = "base_xp_reward";
        expressionAttributeValues[":base_xp_reward"] = updates.base_xp_reward;
    }

    if (updates.base_gold_reward !== undefined) {
        updateExpressions.push("#base_gold_reward = :base_gold_reward");
        expressionAttributeNames["#base_gold_reward"] = "base_gold_reward";
        expressionAttributeValues[":base_gold_reward"] = updates.base_gold_reward;
    }

    if (updates.is_shared_publicly !== undefined) {
        updateExpressions.push("#is_shared_publicly = :is_shared_publicly");
        expressionAttributeNames["#is_shared_publicly"] = "is_shared_publicly";
        // Store as string for GSI2
        expressionAttributeValues[":is_shared_publicly"] = updates.is_shared_publicly ? "true" : "false";
    }

    if (updates.public_sort !== undefined) {
        updateExpressions.push("#public_sort = :public_sort");
        expressionAttributeNames["#public_sort"] = "public_sort";
        expressionAttributeValues[":public_sort"] = updates.public_sort;
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
            Key: { boss_template_id },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: "attribute_exists(boss_template_id)",
        })
    );
}

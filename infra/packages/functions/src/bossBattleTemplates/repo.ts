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
 * By default returns null if the template is soft-deleted
 */
export async function getTemplate(
    boss_template_id: string,
    options?: { includeDeleted?: boolean }
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

    const item = {
        ...result.Item,
        is_shared_publicly: result.Item.is_shared_publicly === "true",
    } as BossBattleTemplateItem;

    // Filter out soft-deleted items unless explicitly requested
    if (item.is_deleted && !options?.includeDeleted) {
        return null;
    }

    return item;
}

/**
 * List all templates owned by a teacher
 * Query gsi1 by owner_teacher_id
 * By default, filters out soft-deleted templates
 */
export async function listByOwner(
    owner_teacher_id: string,
    options?: { includeDeleted?: boolean }
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

    const items = ((result.Items ?? []) as any[]).map(item => ({
        ...item,
        is_shared_publicly: item.is_shared_publicly === "true",
    })) as BossBattleTemplateItem[];

    // Filter out soft-deleted items unless explicitly requested
    if (!options?.includeDeleted) {
        return items.filter(item => !item.is_deleted);
    }

    return items;
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
        ":is_del_false": false,
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
            // Exclude soft-deleted items; keep backwards compat with items missing the field
            FilterExpression: "attribute_not_exists(#is_deleted) OR #is_deleted = :is_del_false",
            ExpressionAttributeNames: {
                "#is_deleted": "is_deleted",
            },
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

/**
 * Soft-delete a boss battle template
 * Sets is_deleted=true, deleted_at=now, deleted_by_teacher_id
 * Uses a condition so it only fires if the item exists
 */
export async function softDeleteTemplate(
    boss_template_id: string,
    deleted_by_teacher_id: string
): Promise<BossBattleTemplateItem> {
    const now = new Date().toISOString();

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { boss_template_id },
            UpdateExpression:
                "SET #is_deleted = :is_deleted, #deleted_at = :deleted_at, #deleted_by = :deleted_by, #updated_at = :updated_at",
            ExpressionAttributeNames: {
                "#is_deleted": "is_deleted",
                "#deleted_at": "deleted_at",
                "#deleted_by": "deleted_by_teacher_id",
                "#updated_at": "updated_at",
            },
            ExpressionAttributeValues: {
                ":is_deleted": true,
                ":deleted_at": now,
                ":deleted_by": deleted_by_teacher_id,
                ":updated_at": now,
            },
            ConditionExpression: "attribute_exists(boss_template_id)",
            ReturnValues: "ALL_NEW",
        })
    );

    const raw = result.Attributes as any;
    return {
        ...raw,
        is_shared_publicly: raw.is_shared_publicly === "true",
    } as BossBattleTemplateItem;
}

/**
 * Restore a soft-deleted boss battle template
 * Clears is_deleted, deleted_at, deleted_by_teacher_id; updates updated_at
 */
export async function restoreTemplate(
    boss_template_id: string
): Promise<BossBattleTemplateItem> {
    const now = new Date().toISOString();

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { boss_template_id },
            UpdateExpression:
                "SET #is_deleted = :false, #updated_at = :updated_at REMOVE #deleted_at, #deleted_by",
            ExpressionAttributeNames: {
                "#is_deleted": "is_deleted",
                "#updated_at": "updated_at",
                "#deleted_at": "deleted_at",
                "#deleted_by": "deleted_by_teacher_id",
            },
            ExpressionAttributeValues: {
                ":false": false,
                ":updated_at": now,
            },
            ConditionExpression: "attribute_exists(boss_template_id)",
            ReturnValues: "ALL_NEW",
        })
    );

    const raw = result.Attributes as any;
    return {
        ...raw,
        is_shared_publicly: raw.is_shared_publicly === "true",
    } as BossBattleTemplateItem;
}

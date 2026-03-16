import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { RewardMilestoneItem, UpdateRewardMilestoneInput } from "./types.ts";
import { buildUnlockSort, buildTeacherSort } from "./keys.ts";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.REWARD_MILESTONES_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing REWARD_MILESTONES_TABLE_NAME environment variable");
}

/**
 * Create a new reward milestone.
 * Conditional write guards against duplicate reward_id.
 */
export async function createRewardMilestone(item: RewardMilestoneItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(reward_id)",
        })
    );
}

/**
 * Get a reward milestone by primary key.
 * Returns null if not found.
 */
export async function getRewardMilestoneById(
    reward_id: string
): Promise<RewardMilestoneItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { reward_id },
        })
    );
    return (result.Item as RewardMilestoneItem) ?? null;
}

/**
 * List reward milestones for a class using GSI1.
 * Sorted by unlock_sort (active-first, then by level).
 * Excludes soft-deleted items unless includeDeleted is true.
 */
export async function listRewardMilestonesByClass(
    class_id: string,
    options?: { includeDeleted?: boolean }
): Promise<RewardMilestoneItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "GSI1",
            KeyConditionExpression: "class_id = :cid",
            ExpressionAttributeValues: { ":cid": class_id },
        })
    );

    const items = (result.Items as RewardMilestoneItem[]) ?? [];
    return options?.includeDeleted ? items : items.filter(i => !i.is_deleted);
}

/**
 * List reward milestones created by a teacher using GSI2.
 * Sorted by teacher_sort (class_id, then active-first, then level).
 * Excludes soft-deleted items unless includeDeleted is true.
 */
export async function listRewardMilestonesByTeacher(
    created_by_teacher_id: string,
    options?: { includeDeleted?: boolean }
): Promise<RewardMilestoneItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "GSI2",
            KeyConditionExpression: "created_by_teacher_id = :tid",
            ExpressionAttributeValues: { ":tid": created_by_teacher_id },
        })
    );

    const items = (result.Items as RewardMilestoneItem[]) ?? [];
    return options?.includeDeleted ? items : items.filter(i => !i.is_deleted);
}

/**
 * Update editable fields on a reward milestone.
 * Recomputes unlock_sort and teacher_sort when unlock_level or type changes.
 */
export async function updateRewardMilestone(
    reward_id: string,
    updates: UpdateRewardMilestoneInput & {
        // Caller must supply current values for sort key recomputation
        current_class_id: string;
        current_is_active: boolean;
        current_unlock_level: number;
        current_type: string;
    }
): Promise<void> {
    const now = new Date().toISOString();

    const setExprs: string[] = ["#updated_at = :updated_at"];
    const names: Record<string, string> = { "#updated_at": "updated_at" };
    const values: Record<string, any> = { ":updated_at": now };

    if (updates.title !== undefined) {
        setExprs.push("#title = :title");
        names["#title"] = "title";
        values[":title"] = updates.title;
    }
    if (updates.description !== undefined) {
        setExprs.push("#description = :description");
        names["#description"] = "description";
        values[":description"] = updates.description;
    }
    if (updates.reward_target_type !== undefined) {
        setExprs.push("#reward_target_type = :reward_target_type");
        names["#reward_target_type"] = "reward_target_type";
        values[":reward_target_type"] = updates.reward_target_type;
    }
    if (updates.reward_target_id !== undefined) {
        setExprs.push("#reward_target_id = :reward_target_id");
        names["#reward_target_id"] = "reward_target_id";
        values[":reward_target_id"] = updates.reward_target_id;
    }
    if (updates.image_asset_key !== undefined) {
        if (updates.image_asset_key === null) {
            // null → remove the attribute from the record
            // handled in REMOVE clause below
            names["#image_asset_key"] = "image_asset_key";
        } else {
            setExprs.push("#image_asset_key = :image_asset_key");
            names["#image_asset_key"] = "image_asset_key";
            values[":image_asset_key"] = updates.image_asset_key;
        }
    }
    if (updates.notes !== undefined) {
        setExprs.push("#notes = :notes");
        names["#notes"] = "notes";
        values[":notes"] = updates.notes;
    }
    if (updates.updated_by_teacher_id !== undefined) {
        setExprs.push("#updated_by = :updated_by");
        names["#updated_by"] = "updated_by_teacher_id";
        values[":updated_by"] = updates.updated_by_teacher_id;
    }

    // When level or type changes, recompute both sort keys
    const newLevel = updates.unlock_level ?? updates.current_unlock_level;
    const newType = updates.type ?? updates.current_type;
    const sortKeysChanged =
        updates.unlock_level !== undefined || updates.type !== undefined;

    if (updates.unlock_level !== undefined) {
        setExprs.push("#unlock_level = :unlock_level");
        names["#unlock_level"] = "unlock_level";
        values[":unlock_level"] = updates.unlock_level;
    }
    if (updates.type !== undefined) {
        setExprs.push("#type = :type");
        names["#type"] = "type";
        values[":type"] = updates.type;
    }
    if (sortKeysChanged) {
        const newUnlockSort = buildUnlockSort(
            updates.current_is_active,
            newLevel,
            newType,
            reward_id
        );
        const newTeacherSort = buildTeacherSort(
            updates.current_class_id,
            updates.current_is_active,
            newLevel,
            reward_id
        );
        setExprs.push("#unlock_sort = :unlock_sort", "#teacher_sort = :teacher_sort");
        names["#unlock_sort"] = "unlock_sort";
        names["#teacher_sort"] = "teacher_sort";
        values[":unlock_sort"] = newUnlockSort;
        values[":teacher_sort"] = newTeacherSort;
    }

    let updateExpr = "SET " + setExprs.join(", ");
    if (updates.image_asset_key === null) {
        updateExpr += " REMOVE #image_asset_key";
    }

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { reward_id },
            UpdateExpression: updateExpr,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ConditionExpression: "attribute_exists(reward_id)",
        })
    );
}

/**
 * Activate or deactivate a reward milestone.
 * Recomputes both sort keys since they encode the active/inactive prefix.
 */
export async function setRewardMilestoneStatus(
    reward_id: string,
    is_active: boolean,
    current: { class_id: string; unlock_level: number; type: string }
): Promise<void> {
    const now = new Date().toISOString();
    const unlockSort = buildUnlockSort(is_active, current.unlock_level, current.type, reward_id);
    const teacherSort = buildTeacherSort(current.class_id, is_active, current.unlock_level, reward_id);

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { reward_id },
            UpdateExpression:
                "SET #is_active = :is_active, #unlock_sort = :unlock_sort, " +
                "#teacher_sort = :teacher_sort, #updated_at = :updated_at",
            ExpressionAttributeNames: {
                "#is_active":    "is_active",
                "#unlock_sort":  "unlock_sort",
                "#teacher_sort": "teacher_sort",
                "#updated_at":   "updated_at",
            },
            ExpressionAttributeValues: {
                ":is_active":    is_active,
                ":unlock_sort":  unlockSort,
                ":teacher_sort": teacherSort,
                ":updated_at":   now,
            },
            ConditionExpression: "attribute_exists(reward_id)",
        })
    );
}

/**
 * Soft-delete a reward milestone.
 * Sets is_deleted=true, records deleted_at. Does NOT remove the item.
 */
export async function softDeleteRewardMilestone(reward_id: string): Promise<void> {
    const now = new Date().toISOString();

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { reward_id },
            UpdateExpression:
                "SET #is_deleted = :true, #deleted_at = :now, #updated_at = :now",
            ExpressionAttributeNames: {
                "#is_deleted": "is_deleted",
                "#deleted_at": "deleted_at",
                "#updated_at": "updated_at",
            },
            ExpressionAttributeValues: {
                ":true": true,
                ":now":  now,
            },
            ConditionExpression: "attribute_exists(reward_id)",
        })
    );
}

/**
 * Restore a soft-deleted reward milestone.
 * Clears is_deleted flag and removes deleted_at.
 */
export async function restoreRewardMilestone(reward_id: string): Promise<void> {
    const now = new Date().toISOString();

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { reward_id },
            UpdateExpression:
                "SET #is_deleted = :false, #updated_at = :now REMOVE #deleted_at",
            ExpressionAttributeNames: {
                "#is_deleted": "is_deleted",
                "#updated_at": "updated_at",
                "#deleted_at": "deleted_at",
            },
            ExpressionAttributeValues: {
                ":false": false,
                ":now":   now,
            },
            ConditionExpression: "attribute_exists(reward_id)",
        })
    );
}

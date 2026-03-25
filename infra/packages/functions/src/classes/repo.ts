import {
    DynamoDBClient,
    ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { ClassItem } from "./types.ts";

// Initialize DynamoDB client
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.CLASSES_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing CLASSES_TABLE_NAME environment variable");
}

/**
 * Create a new class
 * Conditional write ensures both class_id and join_code are unique
 */
export async function putClass(item: ClassItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            // Prevent duplicate class_id (PK) and duplicate join_code (GSI3)
            ConditionExpression:
                "attribute_not_exists(class_id) AND attribute_not_exists(join_code)",
        })
    );
}

/**
 * Get class by primary key (class_id)
 */
export async function getClass(
    class_id: string
): Promise<ClassItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { class_id },
        })
    );
    return (result.Item as ClassItem) ?? null;
}

/**
 * Get class by join code (queries GSI3)
 * Returns single item or null
 */
export async function getClassByJoinCode(
    join_code: string
): Promise<ClassItem | null> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "GSI3",
            KeyConditionExpression: "join_code = :jc",
            ExpressionAttributeValues: {
                ":jc": join_code,
            },
        })
    );

    // Join codes should be unique, return first match or null
    return (result.Items?.[0] as ClassItem) ?? null;
}

/**
 * List all classes created by a teacher (queries GSI1)
 */
export async function listClassesByTeacher(
    teacher_id: string
): Promise<ClassItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "GSI1",
            KeyConditionExpression: "created_by_teacher_id = :tid",
            ExpressionAttributeValues: {
                ":tid": teacher_id,
            },
        })
    );

    return (result.Items as ClassItem[]) ?? [];
}

/**
 * List all classes in a school (queries GSI2 - multi-tenancy)
 */
export async function listClassesBySchool(
    school_id: string
): Promise<ClassItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "GSI2",
            KeyConditionExpression: "school_id = :sid",
            ExpressionAttributeValues: {
                ":sid": school_id,
            },
        })
    );

    return (result.Items as ClassItem[]) ?? [];
}

export type UpdateClassFields = {
    name?: string;
    subject?: string;
    grade_level?: number;
    is_active?: boolean;
};

/**
 * Partially update allowed class fields.
 * Protects: class_id, school_id, created_by_teacher_id, join_code, created_at.
 * Always stamps updated_at = now.
 * When is_active changes true→false: sets deactivated_at.
 * When is_active changes false→true: removes deactivated_at.
 * Returns updated item.
 */
export async function updateClass(
    class_id: string,
    fields: UpdateClassFields,
    currentIsActive: boolean
): Promise<ClassItem> {
    const now = new Date().toISOString();

    // Build SET clause dynamically — only provided fields
    const setParts: string[] = ["updated_at = :now"];
    const exprValues: Record<string, any> = { ":now": now };
    const exprNames: Record<string, string> = {};
    const removeParts: string[] = [];

    if (fields.name !== undefined) {
        setParts.push("#name = :name");
        exprNames["#name"] = "name";
        exprValues[":name"] = fields.name;
    }
    if (fields.subject !== undefined) {
        setParts.push("subject = :subject");
        exprValues[":subject"] = fields.subject;
    }
    if (fields.grade_level !== undefined) {
        setParts.push("grade_level = :grade_level");
        exprValues[":grade_level"] = fields.grade_level;
    }
    if (fields.is_active !== undefined) {
        setParts.push("is_active = :is_active");
        exprValues[":is_active"] = fields.is_active;

        if (fields.is_active === false && currentIsActive === true) {
            // Deactivating: record when
            setParts.push("deactivated_at = :now");
        } else if (fields.is_active === true && currentIsActive === false) {
            // Reactivating: clear deactivated_at
            removeParts.push("deactivated_at");
        }
    }

    let updateExpr = "SET " + setParts.join(", ");
    if (removeParts.length > 0) {
        updateExpr += " REMOVE " + removeParts.join(", ");
    }

    const result = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { class_id },
            UpdateExpression: updateExpr,
            ExpressionAttributeValues: exprValues,
            ...(Object.keys(exprNames).length > 0 && { ExpressionAttributeNames: exprNames }),
            ConditionExpression: "attribute_exists(class_id)",
            ReturnValues: "ALL_NEW",
        })
    );

    return result.Attributes as ClassItem;
}

/**
 * Deactivate a class (soft delete)
 * Sets is_active=false, deactivated_at=now, updated_at=now
 */
export async function deactivateClass(class_id: string): Promise<void> {
    const now = new Date().toISOString();

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { class_id },
            UpdateExpression:
                "SET is_active = :false, deactivated_at = :now, updated_at = :now",
            ExpressionAttributeValues: {
                ":false": false,
                ":now": now,
            },
            // Return 404 if class doesn't exist
            ConditionExpression: "attribute_exists(class_id)",
        })
    );
}

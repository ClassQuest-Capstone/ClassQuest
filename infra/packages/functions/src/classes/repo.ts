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

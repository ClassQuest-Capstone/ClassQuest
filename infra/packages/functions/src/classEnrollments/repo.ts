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
    DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { EnrollmentItem } from "./types.ts";

// Initialize DynamoDB client
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.CLASS_ENROLLMENTS_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing CLASS_ENROLLMENTS_TABLE_NAME environment variable");
}

/**
 * Create enrollment (student joins class)
 * To prevent duplicates: caller must check if enrollment exists first
 */
export async function putEnrollment(item: EnrollmentItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            // Prevent overwriting existing enrollment_id
            ConditionExpression: "attribute_not_exists(enrollment_id)",
        })
    );
}

/**
 * Get enrollment by primary key
 */
export async function getEnrollment(
    enrollment_id: string
): Promise<EnrollmentItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { enrollment_id },
        })
    );
    return (result.Item as EnrollmentItem) ?? null;
}

/**
 * Check if student is already enrolled in class
 * Query gsi1 by class_id, then filter by student_id
 */
export async function findEnrollmentByClassAndStudent(
    class_id: string,
    student_id: string
): Promise<EnrollmentItem | null> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",  // lowercase to match table definition
            KeyConditionExpression: "class_id = :cid",
            FilterExpression: "student_id = :sid",
            ExpressionAttributeValues: {
                ":cid": class_id,
                ":sid": student_id,
            },
        })
    );

    // Should return at most 1 item (enforced by application logic)
    return (result.Items?.[0] as EnrollmentItem) ?? null;
}

/**
 * List all students enrolled in a class (active only)
 * Query gsi1 by class_id
 */
export async function listStudentsByClass(
    class_id: string
): Promise<EnrollmentItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "class_id = :cid",
            FilterExpression: "#status = :active",  // Only active enrollments
            ExpressionAttributeNames: {
                "#status": "status",  // 'status' is reserved word in DynamoDB
            },
            ExpressionAttributeValues: {
                ":cid": class_id,
                ":active": "active",
            },
        })
    );

    return (result.Items as EnrollmentItem[]) ?? [];
}

/**
 * List all classes a student is enrolled in (active only)
 * Query gsi2 by student_id
 */
export async function listClassesByStudent(
    student_id: string
): Promise<EnrollmentItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi2",
            KeyConditionExpression: "student_id = :sid",
            FilterExpression: "#status = :active",
            ExpressionAttributeNames: {
                "#status": "status",
            },
            ExpressionAttributeValues: {
                ":sid": student_id,
                ":active": "active",
            },
        })
    );

    return (result.Items as EnrollmentItem[]) ?? [];
}

/**
 * Drop enrollment (soft delete)
 * Sets status="dropped", dropped_at=now
 */
export async function dropEnrollment(enrollment_id: string): Promise<void> {
    const now = new Date().toISOString();

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { enrollment_id },
            UpdateExpression: "SET #status = :dropped, dropped_at = :now",
            ExpressionAttributeNames: {
                "#status": "status",
            },
            ExpressionAttributeValues: {
                ":dropped": "dropped",
                ":now": now,
            },
            // Return 404 if enrollment doesn't exist
            ConditionExpression: "attribute_exists(enrollment_id)",
        })
    );
}

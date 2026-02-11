import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { QuestInstanceItem, QuestInstanceStatus } from "./types.ts";

// Initialize DynamoDB client
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.QUEST_INSTANCES_TABLE_NAME;

if (!TABLE) {
    throw new Error("Missing QUEST_INSTANCES_TABLE_NAME environment variable");
}

/**
 * Create a new quest instance
 * Conditional write ensures quest_instance_id is unique
 */
export async function createInstance(item: QuestInstanceItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(quest_instance_id)",
        })
    );
}

/**
 * Get quest instance by primary key
 */
export async function getInstance(
    quest_instance_id: string
): Promise<QuestInstanceItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { quest_instance_id },
        })
    );
    return (result.Item as QuestInstanceItem) ?? null;
}

/**
 * List all quest instances for a class
 * Query gsi1 by class_id
 */
export async function listByClass(
    class_id: string
): Promise<QuestInstanceItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "class_id = :cid",
            ExpressionAttributeValues: {
                ":cid": class_id,
            },
        })
    );

    return (result.Items as QuestInstanceItem[]) ?? [];
}

/**
 * List all instances created from a template
 * Query gsi2 by quest_template_id
 */
export async function listByTemplate(
    quest_template_id: string
): Promise<QuestInstanceItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi2",
            KeyConditionExpression: "quest_template_id = :tid",
            ExpressionAttributeValues: {
                ":tid": quest_template_id,
            },
        })
    );

    return (result.Items as QuestInstanceItem[]) ?? [];
}

/**
 * Update quest instance status
 */
export async function updateStatus(
    quest_instance_id: string,
    status: QuestInstanceStatus
): Promise<void> {
    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { quest_instance_id },
            UpdateExpression: "SET #status = :status, #updated_at = :updated_at",
            ExpressionAttributeNames: {
                "#status": "status",
                "#updated_at": "updated_at",
            },
            ExpressionAttributeValues: {
                ":status": status,
                ":updated_at": new Date().toISOString(),
            },
            ConditionExpression: "attribute_exists(quest_instance_id)",
        })
    );
}

/**
 * Update quest instance dates
 * Supports setting dates to null by using REMOVE
 */
export async function updateDates(
    quest_instance_id: string,
    start_date?: string | null,
    due_date?: string | null
): Promise<void> {
    const setExpressions: string[] = [];
    const removeExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Always update updated_at
    setExpressions.push("#updated_at = :updated_at");
    expressionAttributeNames["#updated_at"] = "updated_at";
    expressionAttributeValues[":updated_at"] = new Date().toISOString();

    // Handle start_date
    if (start_date !== undefined) {
        if (start_date === null) {
            removeExpressions.push("#start_date");
            expressionAttributeNames["#start_date"] = "start_date";
        } else {
            setExpressions.push("#start_date = :start_date");
            expressionAttributeNames["#start_date"] = "start_date";
            expressionAttributeValues[":start_date"] = start_date;
        }
    }

    // Handle due_date
    if (due_date !== undefined) {
        if (due_date === null) {
            removeExpressions.push("#due_date");
            expressionAttributeNames["#due_date"] = "due_date";
        } else {
            setExpressions.push("#due_date = :due_date");
            expressionAttributeNames["#due_date"] = "due_date";
            expressionAttributeValues[":due_date"] = due_date;
        }
    }

    // Build update expression
    let updateExpression = "";
    if (setExpressions.length > 0) {
        updateExpression += "SET " + setExpressions.join(", ");
    }
    if (removeExpressions.length > 0) {
        if (updateExpression.length > 0) updateExpression += " ";
        updateExpression += "REMOVE " + removeExpressions.join(", ");
    }

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { quest_instance_id },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues:
                Object.keys(expressionAttributeValues).length > 0
                    ? expressionAttributeValues
                    : undefined,
            ConditionExpression: "attribute_exists(quest_instance_id)",
        })
    );
}

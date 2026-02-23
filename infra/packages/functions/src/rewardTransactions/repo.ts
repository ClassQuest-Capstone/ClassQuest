import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { RewardTransactionItem } from "./types.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.REWARD_TRANSACTIONS_TABLE_NAME!;
if (!TABLE) throw new Error("Missing REWARD_TRANSACTIONS_TABLE_NAME");

export type PaginationCursor = string;

export type PaginatedResult<T> = {
    items: T[];
    cursor?: PaginationCursor;
};

/**
 * Create a new transaction with conditional put (idempotency)
 */
export async function putTransaction(item: RewardTransactionItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(transaction_id)",
        })
    );
}

/**
 * Get transaction by ID
 */
export async function getTransaction(
    transaction_id: string
): Promise<RewardTransactionItem | null> {
    const res = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { transaction_id },
        })
    );
    return (res.Item as RewardTransactionItem) ?? null;
}

/**
 * List transactions by student (GSI1)
 */
export async function listByStudent(
    student_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<RewardTransactionItem>> {
    const gsi1_pk = `S#${student_id}`;

    const res = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "gsi1_pk = :pk",
            ExpressionAttributeValues: { ":pk": gsi1_pk },
            ScanIndexForward: false, // descending order (most recent first)
            Limit: limit,
            ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : undefined,
        })
    );

    return {
        items: (res.Items as RewardTransactionItem[]) ?? [],
        cursor: res.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * List transactions by student and class (GSI2)
 */
export async function listByStudentAndClass(
    student_id: string,
    class_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<RewardTransactionItem>> {
    const gsi2_pk = `C#${class_id}#S#${student_id}`;

    const res = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi2",
            KeyConditionExpression: "gsi2_pk = :pk",
            ExpressionAttributeValues: { ":pk": gsi2_pk },
            ScanIndexForward: false, // descending order (most recent first)
            Limit: limit,
            ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : undefined,
        })
    );

    return {
        items: (res.Items as RewardTransactionItem[]) ?? [],
        cursor: res.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

/**
 * List transactions by source (GSI3)
 */
export async function listBySource(
    source_type: string,
    source_id: string,
    limit?: number,
    cursor?: PaginationCursor
): Promise<PaginatedResult<RewardTransactionItem>> {
    const gsi3_pk = `SRC#${source_type}#${source_id}`;

    const res = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "gsi3",
            KeyConditionExpression: "gsi3_pk = :pk",
            ExpressionAttributeValues: { ":pk": gsi3_pk },
            ScanIndexForward: false, // descending order (most recent first)
            Limit: limit,
            ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : undefined,
        })
    );

    return {
        items: (res.Items as RewardTransactionItem[]) ?? [],
        cursor: res.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

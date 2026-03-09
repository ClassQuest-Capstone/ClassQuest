import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { StudentRewardClaimItem } from "./types.ts";
import type { ClaimStatus } from "./keys.ts";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.STUDENT_REWARD_CLAIMS_TABLE_NAME;
if (!TABLE) {
    throw new Error("Missing STUDENT_REWARD_CLAIMS_TABLE_NAME environment variable");
}

/**
 * Create a new student reward claim.
 * Conditional write guards against duplicate student_reward_claim_id.
 */
export async function createStudentRewardClaim(item: StudentRewardClaimItem): Promise<void> {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(student_reward_claim_id)",
        })
    );
}

/**
 * Get a student reward claim by primary key.
 * Returns null if not found.
 */
export async function getStudentRewardClaimById(
    student_reward_claim_id: string
): Promise<StudentRewardClaimItem | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { student_reward_claim_id },
        })
    );
    return (result.Item as StudentRewardClaimItem) ?? null;
}

/**
 * List all claims for a student using GSI1 (student_id).
 * Returns sorted by claim_sort: status → class → level → reward_id.
 */
export async function listStudentRewardClaimsByStudent(
    student_id: string,
    options?: { status?: ClaimStatus }
): Promise<StudentRewardClaimItem[]> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "GSI1",
            KeyConditionExpression: "student_id = :sid",
            ExpressionAttributeValues: { ":sid": student_id },
        })
    );
    let items = (result.Items as StudentRewardClaimItem[]) ?? [];
    if (options?.status) {
        items = items.filter(i => i.status === options.status);
    }
    return items;
}

/**
 * List claims for a student filtered by class.
 * Queries GSI1 then filters client-side on class_id.
 */
export async function listStudentRewardClaimsByStudentAndClass(
    student_id: string,
    class_id: string,
    options?: { status?: ClaimStatus }
): Promise<StudentRewardClaimItem[]> {
    const all = await listStudentRewardClaimsByStudent(student_id, options);
    return all.filter(i => i.class_id === class_id);
}

/**
 * Find whether a student already has a claim row for a specific reward.
 * Uses GSI2 (reward_id PK + student_id SK).
 * Used for duplicate prevention during level-up sync and create.
 */
export async function getStudentRewardClaimByRewardAndStudent(
    reward_id: string,
    student_id: string
): Promise<StudentRewardClaimItem | null> {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: "GSI2",
            KeyConditionExpression: "reward_id = :rid AND student_id = :sid",
            ExpressionAttributeValues: { ":rid": reward_id, ":sid": student_id },
            Limit: 1,
        })
    );
    const items = (result.Items as StudentRewardClaimItem[]) ?? [];
    return items[0] ?? null;
}

/**
 * Update claim status (AVAILABLE → CLAIMED).
 * Recomputes claim_sort since status is part of the sort key.
 * Conditional: only succeeds if current status is AVAILABLE.
 * Throws ConditionalCheckFailedException if already claimed or item not found.
 */
export async function updateStudentRewardClaimStatus(
    student_reward_claim_id: string,
    new_status: ClaimStatus,
    new_claim_sort: string,
    claimed_at?: string,
): Promise<void> {
    const now = new Date().toISOString();

    const setExprs: string[] = [
        "#status = :new_status",
        "#claim_sort = :new_claim_sort",
        "#updated_at = :updated_at",
    ];
    const names: Record<string, string> = {
        "#status":      "status",
        "#claim_sort":  "claim_sort",
        "#updated_at":  "updated_at",
    };
    const values: Record<string, any> = {
        ":new_status":    new_status,
        ":new_claim_sort": new_claim_sort,
        ":updated_at":    now,
        ":available":     "AVAILABLE",
    };

    if (claimed_at !== undefined) {
        setExprs.push("#claimed_at = :claimed_at");
        names["#claimed_at"] = "claimed_at";
        values[":claimed_at"] = claimed_at;
    }

    await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { student_reward_claim_id },
            UpdateExpression: "SET " + setExprs.join(", "),
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ConditionExpression:
                "attribute_exists(student_reward_claim_id) AND #status = :available",
        })
    );
}

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.STUDENT_PROFILES_TABLE_NAME!;
if (!TABLE) throw new Error("Missing STUDENT_PROFILES_TABLE_NAME");

export type StudentProfileItem = {
    student_id: string;     // Users.user_id
    school_id: string;
    display_name: string;
    username: string;
    grade?: string;
    created_at: string;
    updated_at: string;
};

export async function putStudentProfile(item: StudentProfileItem) {
    await ddb.send(
        new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(student_id)", // prevents overwrite
        })
    );
}

export async function getStudentProfile(student_id: string): Promise<StudentProfileItem | null> {
    const res = await ddb.send(
        new GetCommand({
        TableName: TABLE,
        Key: { student_id },
        })
    );
    return (res.Item as StudentProfileItem) ?? null;
}

export async function updateStudentProfile(
    student_id: string, 
    updates: { display_name?: string; username?: string }
): Promise<StudentProfileItem | null> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    if (updates.display_name !== undefined) {
        updateExpressions.push("#display_name = :display_name");
        expressionAttributeNames["#display_name"] = "display_name";
        expressionAttributeValues[":display_name"] = updates.display_name;
    }

    if (updates.username !== undefined) {
        updateExpressions.push("#username = :username");
        expressionAttributeNames["#username"] = "username";
        expressionAttributeValues[":username"] = updates.username;
    }

    if (updateExpressions.length === 0) {
        return await getStudentProfile(student_id);
    }

    // Update the updated_at timestamp
    updateExpressions.push("#updated_at = :updated_at");
    expressionAttributeNames["#updated_at"] = "updated_at";
    expressionAttributeValues[":updated_at"] = new Date().toISOString();

    const res = await ddb.send(
        new UpdateCommand({
            TableName: TABLE,
            Key: { student_id },
            UpdateExpression: `SET ${updateExpressions.join(", ")}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: "ALL_NEW",
        })
    );

    return (res.Attributes as StudentProfileItem) ?? null;
}

export async function listStudentsBySchool(school_id: string): Promise<StudentProfileItem[]> {
    const res = await ddb.send(
        new QueryCommand({
        TableName: TABLE,
        IndexName: "gsi1",
        KeyConditionExpression: "school_id = :sid",
        ExpressionAttributeValues: { ":sid": school_id },
        })
    );
    return (res.Items as StudentProfileItem[]) ?? [];
}

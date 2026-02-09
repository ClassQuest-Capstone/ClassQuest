import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

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

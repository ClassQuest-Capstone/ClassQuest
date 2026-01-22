import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.TEACHER_PROFILES_TABLE_NAME!;
if (!TABLE) throw new Error("Missing TEACHER_PROFILES_TABLE_NAME");

export type TeacherProfileItem = {
    teacher_id: string;     // Users.user_id
    school_id: string;
    display_name: string;
    email: string;
    created_at: string;
    updated_at: string;
};

export async function putTeacherProfile(item: TeacherProfileItem) {
    await ddb.send(
        new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(teacher_id)", // prevents overwrite
        })
    );
}

export async function getTeacherProfile(teacher_id: string): Promise<TeacherProfileItem | null> {
    const res = await ddb.send(
        new GetCommand({
        TableName: TABLE,
        Key: { teacher_id },
        })
    );
    return (res.Item as TeacherProfileItem) ?? null;
}

export async function listTeachersBySchool(school_id: string): Promise<TeacherProfileItem[]> {
    const res = await ddb.send(
        new QueryCommand({
        TableName: TABLE,
        IndexName: "gsi1",
        KeyConditionExpression: "school_id = :sid",
        ExpressionAttributeValues: { ":sid": school_id },
        })
    );
    return (res.Items as TeacherProfileItem[]) ?? [];
}

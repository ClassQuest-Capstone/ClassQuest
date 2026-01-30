import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.SCHOOLS_TABLE_NAME!;
if (!TABLE) throw new Error("Missing SCHOOLS_TABLE_NAME");

export type SchoolItem = {
    school_id: string;
    name: string;
    division: string;
    city: string;
    province: string;
    created_at: string;
    updated_at: string;
};

export async function putSchool(item: SchoolItem) {
    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: "attribute_not_exists(school_id)", // enforces uniqueness
        })
    );
}

export async function getSchool(school_id: string): Promise<SchoolItem | null> {
    const res = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { school_id },
        })
    );
    return (res.Item as SchoolItem) ?? null;
}

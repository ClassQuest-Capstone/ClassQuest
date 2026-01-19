import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const USERS_TABLE = process.env.USERS_TABLE_NAME!;
if (!USERS_TABLE) throw new Error("Missing USERS_TABLE_NAME");

export type UserItem = {
    user_id: string;
    cognito_sub: string;
    role: string;
    status: string;
    created_at: string;
    last_login_at?: string;
};

export async function getUserById(user_id: string): Promise<UserItem | null> {
    const res = await ddb.send(
        new GetCommand({
        TableName: USERS_TABLE,
        Key: { user_id },
        })
    );
    return (res.Item as UserItem) ?? null;
}

// Query-by-cognito pattern
export async function getUserByCognitoSub(cognito_sub: string): Promise<UserItem | null> {
    const res = await ddb.send(
        new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: "gsi1",
        KeyConditionExpression: "cognito_sub = :sub",
        ExpressionAttributeValues: { ":sub": cognito_sub },
        Limit: 1,
        })
    );
    return (res.Items?.[0] as UserItem) ?? null;
}

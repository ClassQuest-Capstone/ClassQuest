import type { PostConfirmationTriggerEvent } from "aws-lambda";
import {
    CognitoIdentityProviderClient,
    AdminAddUserToGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new CognitoIdentityProviderClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: PostConfirmationTriggerEvent) => {
    const userPoolId = event.userPoolId;
    const groupStudents = process.env.GROUP_STUDENTS!;
    const groupTeachersPending = process.env.GROUP_TEACHERS_PENDING!;
    const usersTable = process.env.USERS_TABLE_NAME!;

    const username = event.userName;
    const sub = event.request.userAttributes?.sub || "";

    const role = event.request.userAttributes?.["custom:role"];

    if (!role) {
        console.error("[postConfirmation] MISSING custom:role attribute", {
            username,
            sub,
            allAttributes: event.request.userAttributes,
        });
        throw new Error("Missing custom:role attribute");
    }

    const targetGroup =
        role === "TEACHER" ? groupTeachersPending : groupStudents;

    console.log("[postConfirmation] Assigning user to group", {
        username,
        sub,
        "custom:role": role,
        targetGroup,
    });

    await client.send(
        new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: username,
        GroupName: targetGroup,
        })
    );

    // Write to Users table
    const now = new Date().toISOString();
    try {
        await ddb.send(
            new PutCommand({
                TableName: usersTable,
                Item: {
                    user_id: sub,
                    cognito_sub: sub,
                    role: role.toLowerCase(),
                    status: "active",
                    created_at: now,
                },
                ConditionExpression: "attribute_not_exists(user_id)",
            })
        );
        console.log("[postConfirmation] User record created in DynamoDB", {
            user_id: sub,
            role: role,
        });
    } catch (err: any) {
        if (err?.name === "ConditionalCheckFailedException") {
            console.warn("[postConfirmation] User already exists in DynamoDB", {
                user_id: sub,
            });
        } else {
            console.error("[postConfirmation] Failed to write to Users table", {
                error: err?.message,
                user_id: sub,
            });
            throw err;
        }
    }

    return event;
};

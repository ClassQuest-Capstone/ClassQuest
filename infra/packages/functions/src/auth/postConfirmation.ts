import type { PostConfirmationTriggerEvent } from "aws-lambda";
import {
    CognitoIdentityProviderClient,
    AdminAddUserToGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

export const handler = async (event: PostConfirmationTriggerEvent) => {
    const userPoolId = event.userPoolId;
    const groupStudents = process.env.GROUP_STUDENTS!;
    const groupTeachersPending = process.env.GROUP_TEACHERS_PENDING!;

    const username = event.userName;

    const userType =
        event.request.userAttributes?.["custom:userType"]?.toLowerCase() ?? "student";

    const targetGroup =
        userType === "teacher" ? groupTeachersPending : groupStudents;

    await client.send(
        new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: username,
        GroupName: targetGroup,
        })
    );

    return event;
};

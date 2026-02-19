import { StackContext, Function } from "sst/constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { RemovalPolicy } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";

export const GROUPS = {
    Students: "Students",
    TeachersPending: "TeachersPending",
    Teachers: "Teachers",
} as const;

type AuthStackProps = {
    usersTableName: string;
    usersTableArn: string;
};

/**
 * AuthStack - Contains Cognito UserPool and related resources
 * Exports UserPool ID, ARN, and Client ID for use by other stacks
 */
export function AuthStack(ctx: StackContext, props: AuthStackProps) {
    const { stack } = ctx;
    const { usersTableName, usersTableArn } = props;

    const userPool = new cognito.UserPool(stack, "UserPool", {
        selfSignUpEnabled: true,
        signInAliases: { email: true, username: true },
        // Email verification handled conditionally in preSignUp trigger
        autoVerify: { email: true, phone: false },

        mfa: cognito.Mfa.OPTIONAL,      // later switch to REQUIRED
        mfaSecondFactor: { otp: true, sms: false },
        accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

        passwordPolicy: {
            minLength: 6,
            requireDigits: true,
            requireLowercase: true,
            requireUppercase: true,
            requireSymbols: true,
        },

        // Make phone non-required explicitly
        standardAttributes: {
            phoneNumber: { required: false, mutable: true },
        },
        // Custom attributes for role-based signup
        customAttributes: {
            role: new cognito.StringAttribute({ mutable: true }),
            studentCode: new cognito.StringAttribute({ mutable: true }),
        },

        removalPolicy: RemovalPolicy.DESTROY, // change to RETAIN for prod later
    });

    const userPoolClient = new cognito.UserPoolClient(stack, "UserPoolClient", {
        userPool,
        authFlows: {
            userPassword: true,
            userSrp: true,
        },
        preventUserExistenceErrors: true,
    });

    // Groups
    new cognito.CfnUserPoolGroup(stack, "StudentsGroup", {
        userPoolId: userPool.userPoolId,
        groupName: GROUPS.Students,
        description: "Student accounts",
    });

    new cognito.CfnUserPoolGroup(stack, "TeachersPendingGroup", {
        userPoolId: userPool.userPoolId,
        groupName: GROUPS.TeachersPending,
        description: "Teacher accounts pending subscription/approval",
    });

    new cognito.CfnUserPoolGroup(stack, "TeachersGroup", {
        userPoolId: userPool.userPoolId,
        groupName: GROUPS.Teachers,
        description: "Subscribed teachers (full console access)",
    });

    // Trigger: after a user confirms signup, auto-place them in the right group
    const postConfirmationFn = new Function(stack, "PostConfirmationFn", {
        handler: "packages/functions/src/auth/postConfirmation.handler",
        environment: {
            GROUP_STUDENTS: GROUPS.Students,
            GROUP_TEACHERS_PENDING: GROUPS.TeachersPending,
            USERS_TABLE_NAME: usersTableName,
        },
        permissions: [
            // Allow writing to Users table
            new iam.PolicyStatement({
                actions: [
                    "dynamodb:PutItem",
                    "dynamodb:UpdateItem",
                    "dynamodb:GetItem",
                ],
                resources: [usersTableArn],
            }),
            // Allow adding users to groups
            new iam.PolicyStatement({
                actions: ["cognito-idp:AdminAddUserToGroup"],
                resources: ["*"],
            }),
        ],
    });

    userPool.addTrigger(
        cognito.UserPoolOperation.POST_CONFIRMATION,
        postConfirmationFn
    );

    const preSignUpFn = new Function(stack, "PreSignUpFn", {
        handler: "packages/functions/src/auth/preSignUp.handler",
    });

    userPool.addTrigger(cognito.UserPoolOperation.PRE_SIGN_UP, preSignUpFn);

    // Export for cross-stack references
    stack.addOutputs({
        UserPoolId: userPool.userPoolId,
        UserPoolArn: userPool.userPoolArn,
        UserPoolClientId: userPoolClient.userPoolClientId,
    });

    return {
        userPool,
        userPoolClient,
        userPoolId: userPool.userPoolId,
        userPoolArn: userPool.userPoolArn,
        userPoolClientId: userPoolClient.userPoolClientId,
    };
}

import { StackContext, Function, Table } from "sst/constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { RemovalPolicy } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";


export const GROUPS = {
    Students: "Students",
    TeachersPending: "TeachersPending",
    Teachers: "Teachers",
    } as const;

    export function createAuth(ctx: StackContext, usersTable: Table) {
    const { stack } = ctx;

    const userPool = new cognito.UserPool(stack, "UserPool", {
        selfSignUpEnabled: true,
        signInAliases: { email: true, username: true },
        autoVerify: { email: true },

        passwordPolicy: {
            minLength: 8,
            requireDigits: true,
            requireLowercase: true,
            requireUppercase: false,
            requireSymbols: false,
        },

        // Frontend sends these at signup, so they MUST exist
        customAttributes: {
            userType: new cognito.StringAttribute({ mutable: true }),
            studentCode: new cognito.StringAttribute({ mutable: true }),
        },

        //removalPolicy: RemovalPolicy.DESTROY, // change to RETAIN for prod later
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
        bind: [usersTable],
        environment: {

            GROUP_STUDENTS: GROUPS.Students,
            GROUP_TEACHERS_PENDING: GROUPS.TeachersPending,
            USERS_TABLE_NAME: usersTable.tableName,
        },
    });

    // Allow the trigger to manage users/groups in this pool
    postConfirmationFn.addToRolePolicy(
        new iam.PolicyStatement({
            actions: ["cognito-idp:AdminAddUserToGroup"],
            resources: ["*"],
        })
    );
    userPool.addTrigger(
        cognito.UserPoolOperation.POST_CONFIRMATION,
        postConfirmationFn
    );

    const preSignUpFn = new Function(stack, "PreSignUpFn", {
        handler: "packages/functions/src/auth/preSignUp.handler",
    });

userPool.addTrigger(cognito.UserPoolOperation.PRE_SIGN_UP, preSignUpFn);

    return { userPool, userPoolClient };
}

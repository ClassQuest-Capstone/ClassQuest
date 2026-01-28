import { StackContext } from "sst/constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { RemovalPolicy } from "aws-cdk-lib";

export function createAuth(ctx: StackContext) {
    const { stack } = ctx;

    const userPool = new cognito.UserPool(stack, "UserPool", {
        selfSignUpEnabled: true,
        signInAliases: { email: true },
        autoVerify: { email: true },

        passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: false,
        requireSymbols: false,
        },

        // IMPORTANT: these must exist because your frontend sends:
        // "custom:userType" and "custom:studentCode"
        customAttributes: {
        userType: new cognito.StringAttribute({ mutable: true }),
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

    return { userPool, userPoolClient };
}

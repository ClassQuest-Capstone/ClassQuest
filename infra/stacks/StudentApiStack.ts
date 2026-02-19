import { StackContext, Function } from "sst/constructs";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as iam from "aws-cdk-lib/aws-iam";

type StudentApiStackProps = {
    apiId: string;
    tableNames: {
        usersTable: string;
        teacherProfilesTable: string;
        studentProfilesTable: string;
        schoolsTable: string;
        classesTable: string;
        classEnrollmentsTable: string;
        questTemplatesTable: string;
        questQuestionsTable: string;
        questInstancesTable: string;
        questQuestionResponsesTable: string;
        playerStatesTable: string;
        guildsTable: string;
        guildMembershipsTable: string;
        bossQuestionsTable: string;
        bossBattleTemplatesTable: string;
    };
    tableArns: {
        usersTable: string;
        teacherProfilesTable: string;
        studentProfilesTable: string;
        schoolsTable: string;
        classesTable: string;
        classEnrollmentsTable: string;
        questTemplatesTable: string;
        questQuestionsTable: string;
        questInstancesTable: string;
        questQuestionResponsesTable: string;
        playerStatesTable: string;
        guildsTable: string;
        guildMembershipsTable: string;
        bossQuestionsTable: string;
        bossBattleTemplatesTable: string;
    };
    userPoolId: string;
    userPoolArn: string;
};

/**
 * StudentApiStack - Student domain routes
 * Includes: student-profiles, playerStates
 */
export function StudentApiStack(ctx: StackContext, props: StudentApiStackProps) {
    const { stack } = ctx;
    const { apiId, tableNames, tableArns, userPoolId, userPoolArn } = props;

    // Define routes and their handlers
    const routes: Record<string, { method: string; path: string; handler: string }> = {
        // StudentProfiles
        "POST /student-profiles": { method: "POST", path: "/student-profiles", handler: "packages/functions/src/student-profiles/create.handler" },
        "GET /student-profiles/{student_id}": { method: "GET", path: "/student-profiles/{student_id}", handler: "packages/functions/src/student-profiles/get.handler" },
        "PATCH /student-profiles/{student_id}": { method: "PATCH", path: "/student-profiles/{student_id}", handler: "packages/functions/src/student-profiles/update.handler" },
        "GET /schools/{school_id}/students": { method: "GET", path: "/schools/{school_id}/students", handler: "packages/functions/src/student-profiles/list-by-school.handler" },
        "POST /students/{student_id}/set-password": { method: "POST", path: "/students/{student_id}/set-password", handler: "packages/functions/src/student-profiles/set-password.handler" },

        // PlayerStates
        "PUT /classes/{class_id}/players/{student_id}/state": { method: "PUT", path: "/classes/{class_id}/players/{student_id}/state", handler: "packages/functions/src/playerStates/upsert-state.handler" },
        "GET /classes/{class_id}/players/{student_id}/state": { method: "GET", path: "/classes/{class_id}/players/{student_id}/state", handler: "packages/functions/src/playerStates/get.handler" },
        "GET /classes/{class_id}/leaderboard": { method: "GET", path: "/classes/{class_id}/leaderboard", handler: "packages/functions/src/playerStates/get-leaderboard.handler" },
    };

    // Create Lambda functions and wire routes
    const functions: Record<string, Function> = {};
    const tableArnList = Object.values(tableArns);

    Object.entries(routes).forEach(([routeKey, config]) => {
        const funcId = routeKey.replace(/[^a-zA-Z0-9]/g, "");

        // Create Lambda function
        const fn = new Function(stack, funcId, {
            handler: config.handler,
            environment: {
                USERS_TABLE_NAME: tableNames.usersTable,
                STUDENT_PROFILES_TABLE_NAME: tableNames.studentProfilesTable,
                TEACHER_PROFILES_TABLE_NAME: tableNames.teacherProfilesTable,
                SCHOOLS_TABLE_NAME: tableNames.schoolsTable,
                CLASSES_TABLE_NAME: tableNames.classesTable,
                CLASS_ENROLLMENTS_TABLE_NAME: tableNames.classEnrollmentsTable,
                QUEST_TEMPLATES_TABLE_NAME: tableNames.questTemplatesTable,
                QUEST_QUESTIONS_TABLE_NAME: tableNames.questQuestionsTable,
                QUEST_INSTANCES_TABLE_NAME: tableNames.questInstancesTable,
                QUEST_QUESTION_RESPONSES_TABLE_NAME: tableNames.questQuestionResponsesTable,
                PLAYER_STATES_TABLE_NAME: tableNames.playerStatesTable,
                GUILDS_TABLE_NAME: tableNames.guildsTable,
                GUILD_MEMBERSHIPS_TABLE_NAME: tableNames.guildMembershipsTable,
                BOSS_QUESTIONS_TABLE_NAME: tableNames.bossQuestionsTable,
                BOSS_BATTLE_TEMPLATES_TABLE_NAME: tableNames.bossBattleTemplatesTable,
                USER_POOL_ID: userPoolId,
            },
        });

        // Attach permissions
        fn.attachPermissions([
            new iam.PolicyStatement({
                actions: [
                    "dynamodb:GetItem",
                    "dynamodb:PutItem",
                    "dynamodb:UpdateItem",
                    "dynamodb:DeleteItem",
                    "dynamodb:Query",
                    "dynamodb:Scan",
                ],
                resources: [
                    ...tableArnList,
                    ...tableArnList.map(arn => `${arn}/index/*`),
                ],
            }),
            new iam.PolicyStatement({
                actions: [
                    "cognito-idp:AdminSetUserPassword",
                    "cognito-idp:AdminUpdateUserAttributes",
                    "cognito-idp:AdminGetUser",
                    "cognito-idp:AdminCreateUser",
                    "cognito-idp:AdminAddUserToGroup",
                ],
                resources: [userPoolArn],
            }),
        ]);

        functions[routeKey] = fn;

        // Create integration
        const integration = new apigatewayv2.CfnIntegration(stack, `${funcId}Integration`, {
            apiId,
            integrationType: "AWS_PROXY",
            integrationUri: fn.functionArn,
            payloadFormatVersion: "2.0",
        });

        // Create route
        new apigatewayv2.CfnRoute(stack, `${funcId}Route`, {
            apiId,
            routeKey: `${config.method} ${config.path}`,
            target: `integrations/${integration.ref}`,
        });

        // Grant API Gateway permission to invoke Lambda
        fn.addPermission(`${funcId}InvokePermission`, {
            principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
            sourceArn: `arn:aws:execute-api:${stack.region}:${stack.account}:${apiId}/*`,
        });
    });

    return {
        functions,
    };
}

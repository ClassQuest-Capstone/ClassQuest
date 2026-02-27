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
 * Uses a single router Lambda (student-router/router.ts) instead of one Lambda per route.
 * This keeps the CloudFormation template well under the 1 MB limit.
 */
export function StudentApiStack(ctx: StackContext, props: StudentApiStackProps) {
    const { stack } = ctx;
    const { apiId, tableNames, tableArns, userPoolId, userPoolArn } = props;

    // Define routes — method + path must exactly match what the router dispatch table uses
    const routes: Record<string, { method: string; path: string }> = {
        // StudentProfiles
        "POST /student-profiles": { method: "POST", path: "/student-profiles" },
        "GET /student-profiles/{student_id}": { method: "GET", path: "/student-profiles/{student_id}" },
        "PATCH /student-profiles/{student_id}": { method: "PATCH", path: "/student-profiles/{student_id}" },
        "GET /schools/{school_id}/students": { method: "GET", path: "/schools/{school_id}/students" },
        "POST /students/{student_id}/set-password": { method: "POST", path: "/students/{student_id}/set-password" },

        // PlayerStates
        "PUT /classes/{class_id}/players/{student_id}/state": { method: "PUT", path: "/classes/{class_id}/players/{student_id}/state" },
        "GET /classes/{class_id}/players/{student_id}/state": { method: "GET", path: "/classes/{class_id}/players/{student_id}/state" },
        "GET /classes/{class_id}/leaderboard": { method: "GET", path: "/classes/{class_id}/leaderboard" },
    };

    // ── ROUTER LAMBDA (replaces individual Lambdas) ──────────────────────────
    const tableArnList = Object.values(tableArns);

    const studentRouter = new Function(stack, "StudentRouter", {
        handler: "packages/functions/src/student-router/router.handler",
        environment: {
            USERS_TABLE_NAME:                         tableNames.usersTable,
            STUDENT_PROFILES_TABLE_NAME:              tableNames.studentProfilesTable,
            TEACHER_PROFILES_TABLE_NAME:              tableNames.teacherProfilesTable,
            SCHOOLS_TABLE_NAME:                       tableNames.schoolsTable,
            CLASSES_TABLE_NAME:                       tableNames.classesTable,
            CLASS_ENROLLMENTS_TABLE_NAME:             tableNames.classEnrollmentsTable,
            QUEST_TEMPLATES_TABLE_NAME:               tableNames.questTemplatesTable,
            QUEST_QUESTIONS_TABLE_NAME:               tableNames.questQuestionsTable,
            QUEST_INSTANCES_TABLE_NAME:               tableNames.questInstancesTable,
            QUEST_QUESTION_RESPONSES_TABLE_NAME:      tableNames.questQuestionResponsesTable,
            PLAYER_STATES_TABLE_NAME:                 tableNames.playerStatesTable,
            GUILDS_TABLE_NAME:                        tableNames.guildsTable,
            GUILD_MEMBERSHIPS_TABLE_NAME:             tableNames.guildMembershipsTable,
            BOSS_QUESTIONS_TABLE_NAME:                tableNames.bossQuestionsTable,
            BOSS_BATTLE_TEMPLATES_TABLE_NAME:         tableNames.bossBattleTemplatesTable,
            USER_POOL_ID:                             userPoolId,
        },
        timeout: 30,
        memorySize: 512,
    });

    studentRouter.attachPermissions([
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

    const sharedIntegration = new apigatewayv2.CfnIntegration(stack, "StudentRouterIntegration", {
        apiId,
        integrationType: "AWS_PROXY",
        integrationUri: studentRouter.functionArn,
        payloadFormatVersion: "2.0",
    });

    studentRouter.addPermission("StudentRouterInvokePermission", {
        principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
        sourceArn: `arn:aws:execute-api:${stack.region}:${stack.account}:${apiId}/*`,
    });

    // Create one CfnRoute per endpoint — all pointing to the shared router integration
    Object.entries(routes).forEach(([routeKey, config]) => {
        const funcId = routeKey.replace(/[^a-zA-Z0-9]/g, "");
        new apigatewayv2.CfnRoute(stack, `${funcId}Route`, {
            apiId,
            routeKey: `${config.method} ${config.path}`,
            target: `integrations/${sharedIntegration.ref}`,
        });
    });

    return {};
}

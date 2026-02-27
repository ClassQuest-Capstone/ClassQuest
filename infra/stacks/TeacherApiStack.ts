import { StackContext, Function } from "sst/constructs";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as iam from "aws-cdk-lib/aws-iam";

type TeacherApiStackProps = {
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
 * TeacherApiStack - Teacher domain routes
 * Uses a single router Lambda (teacher-router/router.ts) instead of one Lambda per route.
 * This keeps the CloudFormation template well under the 1 MB limit.
 */
export function TeacherApiStack(ctx: StackContext, props: TeacherApiStackProps) {
    const { stack } = ctx;
    const { apiId, tableNames, tableArns, userPoolId, userPoolArn } = props;

    // Define routes — method + path must exactly match what the router dispatch table uses
    const routes: Record<string, { method: string; path: string }> = {
        // Schools
        "GET /schools": { method: "GET", path: "/schools" },
        "POST /schools": { method: "POST", path: "/schools" },
        "GET /schools/{school_id}": { method: "GET", path: "/schools/{school_id}" },

        // TeacherProfiles
        "POST /teacher-profiles": { method: "POST", path: "/teacher-profiles" },
        "GET /teacher-profiles/{teacher_id}": { method: "GET", path: "/teacher-profiles/{teacher_id}" },
        "GET /schools/{school_id}/teachers": { method: "GET", path: "/schools/{school_id}/teachers" },

        // Classes
        "POST /classes": { method: "POST", path: "/classes" },
        "GET /classes/{class_id}": { method: "GET", path: "/classes/{class_id}" },
        "GET /classes/join/{join_code}": { method: "GET", path: "/classes/join/{join_code}" },
        "GET /teachers/{teacher_id}/classes": { method: "GET", path: "/teachers/{teacher_id}/classes" },
        "GET /schools/{school_id}/classes": { method: "GET", path: "/schools/{school_id}/classes" },
        "PATCH /classes/{class_id}/deactivate": { method: "PATCH", path: "/classes/{class_id}/deactivate" },

        // ClassEnrollments
        "POST /classes/{class_id}/enroll": { method: "POST", path: "/classes/{class_id}/enroll" },
        "DELETE /enrollments/{enrollment_id}": { method: "DELETE", path: "/enrollments/{enrollment_id}" },
        "GET /classes/{class_id}/students": { method: "GET", path: "/classes/{class_id}/students" },
        "GET /students/{student_id}/classes": { method: "GET", path: "/students/{student_id}/classes" },
        "GET /enrollments/{enrollment_id}": { method: "GET", path: "/enrollments/{enrollment_id}" },

        // QuestInstances
        "POST /classes/{class_id}/quest-instances": { method: "POST", path: "/classes/{class_id}/quest-instances" },
        "GET /quest-instances/{quest_instance_id}": { method: "GET", path: "/quest-instances/{quest_instance_id}" },
        "GET /classes/{class_id}/quest-instances": { method: "GET", path: "/classes/{class_id}/quest-instances" },
        "GET /quest-templates/{quest_template_id}/quest-instances": { method: "GET", path: "/quest-templates/{quest_template_id}/quest-instances" },
        "PATCH /quest-instances/{quest_instance_id}/status": { method: "PATCH", path: "/quest-instances/{quest_instance_id}/status" },
        "PATCH /quest-instances/{quest_instance_id}/dates": { method: "PATCH", path: "/quest-instances/{quest_instance_id}/dates" },

        // Guilds
        "POST /classes/{class_id}/guilds": { method: "POST", path: "/classes/{class_id}/guilds" },
        "GET /guilds/{guild_id}": { method: "GET", path: "/guilds/{guild_id}" },
        "GET /classes/{class_id}/guilds": { method: "GET", path: "/classes/{class_id}/guilds" },
        "PATCH /guilds/{guild_id}": { method: "PATCH", path: "/guilds/{guild_id}" },
        "PATCH /guilds/{guild_id}/deactivate": { method: "PATCH", path: "/guilds/{guild_id}/deactivate" },

        // GuildMemberships
        "PUT /classes/{class_id}/guild-memberships/{student_id}": { method: "PUT", path: "/classes/{class_id}/guild-memberships/{student_id}" },
        "GET /classes/{class_id}/guild-memberships/{student_id}": { method: "GET", path: "/classes/{class_id}/guild-memberships/{student_id}" },
        "GET /guilds/{guild_id}/members": { method: "GET", path: "/guilds/{guild_id}/members" },
        "GET /students/{student_id}/guild-memberships": { method: "GET", path: "/students/{student_id}/guild-memberships" },
        "PATCH /classes/{class_id}/guild-memberships/{student_id}/leave": { method: "PATCH", path: "/classes/{class_id}/guild-memberships/{student_id}/leave" },
    };

    // ── ROUTER LAMBDA (replaces individual Lambdas) ──────────────────────────
    const tableArnList = Object.values(tableArns);

    const teacherRouter = new Function(stack, "TeacherRouter", {
        handler: "packages/functions/src/teacher-router/router.handler",
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

    teacherRouter.attachPermissions([
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

    const sharedIntegration = new apigatewayv2.CfnIntegration(stack, "TeacherRouterIntegration", {
        apiId,
        integrationType: "AWS_PROXY",
        integrationUri: teacherRouter.functionArn,
        payloadFormatVersion: "2.0",
    });

    teacherRouter.addPermission("TeacherRouterInvokePermission", {
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

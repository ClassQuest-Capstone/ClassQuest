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
 * Includes: guilds, guildMemberships, questInstances, auth (future),
 * teacher-profiles, classes, classEnrollments, schools, users
 */
export function TeacherApiStack(ctx: StackContext, props: TeacherApiStackProps) {
    const { stack } = ctx;
    const { apiId, tableNames, tableArns, userPoolId, userPoolArn } = props;

    // Define routes and their handlers
    const routes: Record<string, { method: string; path: string; handler: string }> = {
        // Schools
        "GET /schools": { method: "GET", path: "/schools", handler: "packages/functions/src/schools/list.handler" },
        "POST /schools": { method: "POST", path: "/schools", handler: "packages/functions/src/schools/create.handler" },
        "GET /schools/{school_id}": { method: "GET", path: "/schools/{school_id}", handler: "packages/functions/src/schools/get.handler" },

        // TeacherProfiles
        "POST /teacher-profiles": { method: "POST", path: "/teacher-profiles", handler: "packages/functions/src/teacher-profiles/create.handler" },
        "GET /teacher-profiles/{teacher_id}": { method: "GET", path: "/teacher-profiles/{teacher_id}", handler: "packages/functions/src/teacher-profiles/get.handler" },
        "GET /schools/{school_id}/teachers": { method: "GET", path: "/schools/{school_id}/teachers", handler: "packages/functions/src/teacher-profiles/list-by-school.handler" },

        // Classes
        "POST /classes": { method: "POST", path: "/classes", handler: "packages/functions/src/classes/create.handler" },
        "GET /classes/{class_id}": { method: "GET", path: "/classes/{class_id}", handler: "packages/functions/src/classes/get.handler" },
        "GET /classes/join/{join_code}": { method: "GET", path: "/classes/join/{join_code}", handler: "packages/functions/src/classes/get-by-join-code.handler" },
        "GET /teachers/{teacher_id}/classes": { method: "GET", path: "/teachers/{teacher_id}/classes", handler: "packages/functions/src/classes/list-by-teacher.handler" },
        "GET /schools/{school_id}/classes": { method: "GET", path: "/schools/{school_id}/classes", handler: "packages/functions/src/classes/list-by-school.handler" },
        "PATCH /classes/{class_id}/deactivate": { method: "PATCH", path: "/classes/{class_id}/deactivate", handler: "packages/functions/src/classes/deactivate.handler" },

        // ClassEnrollments
        "POST /classes/{class_id}/enroll": { method: "POST", path: "/classes/{class_id}/enroll", handler: "packages/functions/src/classEnrollments/enroll.handler" },
        "DELETE /enrollments/{enrollment_id}": { method: "DELETE", path: "/enrollments/{enrollment_id}", handler: "packages/functions/src/classEnrollments/unenroll.handler" },
        "GET /classes/{class_id}/students": { method: "GET", path: "/classes/{class_id}/students", handler: "packages/functions/src/classEnrollments/list-by-class.handler" },
        "GET /students/{student_id}/classes": { method: "GET", path: "/students/{student_id}/classes", handler: "packages/functions/src/classEnrollments/list-by-student.handler" },
        "GET /enrollments/{enrollment_id}": { method: "GET", path: "/enrollments/{enrollment_id}", handler: "packages/functions/src/classEnrollments/get.handler" },

        // QuestInstances (REQUIRED in TeacherApiStack)
        "POST /classes/{class_id}/quest-instances": { method: "POST", path: "/classes/{class_id}/quest-instances", handler: "packages/functions/src/questInstances/create.handler" },
        "GET /quest-instances/{quest_instance_id}": { method: "GET", path: "/quest-instances/{quest_instance_id}", handler: "packages/functions/src/questInstances/get.handler" },
        "GET /classes/{class_id}/quest-instances": { method: "GET", path: "/classes/{class_id}/quest-instances", handler: "packages/functions/src/questInstances/list-by-class.handler" },
        "GET /quest-templates/{quest_template_id}/quest-instances": { method: "GET", path: "/quest-templates/{quest_template_id}/quest-instances", handler: "packages/functions/src/questInstances/list-by-template.handler" },
        "PATCH /quest-instances/{quest_instance_id}/status": { method: "PATCH", path: "/quest-instances/{quest_instance_id}/status", handler: "packages/functions/src/questInstances/update-status.handler" },
        "PATCH /quest-instances/{quest_instance_id}/dates": { method: "PATCH", path: "/quest-instances/{quest_instance_id}/dates", handler: "packages/functions/src/questInstances/update-dates.handler" },

        // Guilds (REQUIRED in TeacherApiStack)
        "POST /classes/{class_id}/guilds": { method: "POST", path: "/classes/{class_id}/guilds", handler: "packages/functions/src/guilds/create.handler" },
        "GET /guilds/{guild_id}": { method: "GET", path: "/guilds/{guild_id}", handler: "packages/functions/src/guilds/get.handler" },
        "GET /classes/{class_id}/guilds": { method: "GET", path: "/classes/{class_id}/guilds", handler: "packages/functions/src/guilds/list-by-class.handler" },
        "PATCH /guilds/{guild_id}": { method: "PATCH", path: "/guilds/{guild_id}", handler: "packages/functions/src/guilds/update.handler" },
        "PATCH /guilds/{guild_id}/deactivate": { method: "PATCH", path: "/guilds/{guild_id}/deactivate", handler: "packages/functions/src/guilds/deactivate.handler" },

        // GuildMemberships (REQUIRED in TeacherApiStack)
        "PUT /classes/{class_id}/guild-memberships/{student_id}": { method: "PUT", path: "/classes/{class_id}/guild-memberships/{student_id}", handler: "packages/functions/src/guildMemberships/upsert-membership.handler" },
        "GET /classes/{class_id}/guild-memberships/{student_id}": { method: "GET", path: "/classes/{class_id}/guild-memberships/{student_id}", handler: "packages/functions/src/guildMemberships/get.handler" },
        "GET /guilds/{guild_id}/members": { method: "GET", path: "/guilds/{guild_id}/members", handler: "packages/functions/src/guildMemberships/list-by-guild.handler" },
        "GET /students/{student_id}/guild-memberships": { method: "GET", path: "/students/{student_id}/guild-memberships", handler: "packages/functions/src/guildMemberships/list-by-student.handler" },
        "PATCH /classes/{class_id}/guild-memberships/{student_id}/leave": { method: "PATCH", path: "/classes/{class_id}/guild-memberships/{student_id}/leave", handler: "packages/functions/src/guildMemberships/leave.handler" },
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

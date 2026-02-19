import { StackContext, Function } from "sst/constructs";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as iam from "aws-cdk-lib/aws-iam";

type QuestApiStackProps = {
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
 * QuestApiStack - Quest domain routes
 * Includes: questTemplates, questQuestions, questQuestionResponses,
 * bossBattleTemplates (REQUIRED), bossQuestions (REQUIRED),
 * health.ts (REQUIRED), debug-create.ts (REQUIRED)
 */
export function QuestApiStack(ctx: StackContext, props: QuestApiStackProps) {
    const { stack } = ctx;
    const { apiId, tableNames, tableArns, userPoolId, userPoolArn } = props;

    // Define routes and their handlers
    const routes: Record<string, { method: string; path: string; handler: string }> = {
        // Health endpoint (REQUIRED in QuestApiStack)
        "GET /health": { method: "GET", path: "/health", handler: "packages/functions/src/health.handler" },

        // Debug endpoint (REQUIRED in QuestApiStack)
        "POST /debug/create": { method: "POST", path: "/debug/create", handler: "packages/functions/src/debug-create.handler" },

        // QuestTemplates
        "POST /quest-templates": { method: "POST", path: "/quest-templates", handler: "packages/functions/src/questTemplates/create.handler" },
        "GET /quest-templates/public": { method: "GET", path: "/quest-templates/public", handler: "packages/functions/src/questTemplates/list-public.handler" },
        "GET /quest-templates/{quest_template_id}": { method: "GET", path: "/quest-templates/{quest_template_id}", handler: "packages/functions/src/questTemplates/get.handler" },
        "GET /teachers/{teacher_id}/quest-templates": { method: "GET", path: "/teachers/{teacher_id}/quest-templates", handler: "packages/functions/src/questTemplates/list-by-owner.handler" },
        "PATCH /quest-templates/{quest_template_id}": { method: "PATCH", path: "/quest-templates/{quest_template_id}", handler: "packages/functions/src/questTemplates/update.handler" },
        "PATCH /quest-templates/{quest_template_id}/soft-delete": { method: "PATCH", path: "/quest-templates/{quest_template_id}/soft-delete", handler: "packages/functions/src/questTemplates/soft-delete.handler" },

        // QuestQuestions
        "POST /quest-templates/{template_id}/questions": { method: "POST", path: "/quest-templates/{template_id}/questions", handler: "packages/functions/src/questQuestions/create.handler" },
        "GET /quest-templates/{template_id}/questions": { method: "GET", path: "/quest-templates/{template_id}/questions", handler: "packages/functions/src/questQuestions/list-by-template.handler" },
        "GET /quest-questions/{question_id}": { method: "GET", path: "/quest-questions/{question_id}", handler: "packages/functions/src/questQuestions/get.handler" },
        "PATCH /quest-questions/{question_id}": { method: "PATCH", path: "/quest-questions/{question_id}", handler: "packages/functions/src/questQuestions/update.handler" },
        "DELETE /quest-questions/{question_id}": { method: "DELETE", path: "/quest-questions/{question_id}", handler: "packages/functions/src/questQuestions/delete.handler" },

        // QuestQuestionResponses
        "PUT /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}": { method: "PUT", path: "/quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}", handler: "packages/functions/src/questQuestionResponses/upsert-response.handler" },
        "GET /quest-instances/{quest_instance_id}/responses/{student_id}": { method: "GET", path: "/quest-instances/{quest_instance_id}/responses/{student_id}", handler: "packages/functions/src/questQuestionResponses/get-by-instance-and-student.handler" },
        "GET /quest-instances/{quest_instance_id}/responses": { method: "GET", path: "/quest-instances/{quest_instance_id}/responses", handler: "packages/functions/src/questQuestionResponses/list-by-instance.handler" },
        "GET /students/{student_id}/responses": { method: "GET", path: "/students/{student_id}/responses", handler: "packages/functions/src/questQuestionResponses/list-by-student.handler" },
        "GET /questions/{question_id}/responses": { method: "GET", path: "/questions/{question_id}/responses", handler: "packages/functions/src/questQuestionResponses/list-by-question.handler" },
        "PATCH /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/grade": { method: "PATCH", path: "/quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/grade", handler: "packages/functions/src/questQuestionResponses/grade-response.handler" },

        // BossQuestions (REQUIRED in QuestApiStack)
        "POST /boss-templates/{boss_template_id}/questions": { method: "POST", path: "/boss-templates/{boss_template_id}/questions", handler: "packages/functions/src/bossQuestions/create.handler" },
        "GET /boss-questions/{question_id}": { method: "GET", path: "/boss-questions/{question_id}", handler: "packages/functions/src/bossQuestions/get.handler" },
        "GET /boss-templates/{boss_template_id}/questions": { method: "GET", path: "/boss-templates/{boss_template_id}/questions", handler: "packages/functions/src/bossQuestions/list-by-template.handler" },
        "PATCH /boss-questions/{question_id}": { method: "PATCH", path: "/boss-questions/{question_id}", handler: "packages/functions/src/bossQuestions/update.handler" },
        "DELETE /boss-questions/{question_id}": { method: "DELETE", path: "/boss-questions/{question_id}", handler: "packages/functions/src/bossQuestions/delete.handler" },

        // BossBattleTemplates (REQUIRED in QuestApiStack)
        "POST /boss-battle-templates": { method: "POST", path: "/boss-battle-templates", handler: "packages/functions/src/bossBattleTemplates/create.handler" },
        "GET /boss-battle-templates/{boss_template_id}": { method: "GET", path: "/boss-battle-templates/{boss_template_id}", handler: "packages/functions/src/bossBattleTemplates/get.handler" },
        "GET /teachers/{teacher_id}/boss-battle-templates": { method: "GET", path: "/teachers/{teacher_id}/boss-battle-templates", handler: "packages/functions/src/bossBattleTemplates/list-by-owner.handler" },
        "GET /boss-battle-templates/public": { method: "GET", path: "/boss-battle-templates/public", handler: "packages/functions/src/bossBattleTemplates/list-public.handler" },
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

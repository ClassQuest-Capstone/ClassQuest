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
        rewardTransactionsTable: string;
        questAnswerAttemptsTable: string;
        bossBattleInstancesTable: string;
        bossBattleParticipantsTable: string;
        bossAnswerAttemptsTable: string;
        bossResultsTable: string;
        bossBattleSnapshotsTable: string;
        bossBattleQuestionPlansTable: string;
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
        rewardTransactionsTable: string;
        questAnswerAttemptsTable: string;
        bossBattleInstancesTable: string;
        bossBattleParticipantsTable: string;
        bossAnswerAttemptsTable: string;
        bossResultsTable: string;
        bossBattleSnapshotsTable: string;
        bossBattleQuestionPlansTable: string;
    };
    userPoolId: string;
    userPoolArn: string;
};

/**
 * QuestApiStack - Quest domain routes
 * Uses a single router Lambda (quest-router/router.ts) instead of one Lambda per route.
 * This keeps the CloudFormation template well under the 1 MB limit.
 */
export function QuestApiStack(ctx: StackContext, props: QuestApiStackProps) {
    const { stack } = ctx;
    const { apiId, tableNames, tableArns, userPoolId, userPoolArn } = props;

    // Define routes — method + path must exactly match what the router dispatch table uses
    const routes: Record<string, { method: string; path: string }> = {
        // Health endpoint
        "GET /health": { method: "GET", path: "/health" },

        // Debug endpoint
        "POST /debug/create": { method: "POST", path: "/debug/create" },

        // QuestTemplates
        "POST /quest-templates": { method: "POST", path: "/quest-templates" },
        "GET /quest-templates/public": { method: "GET", path: "/quest-templates/public" },
        "GET /quest-templates/{quest_template_id}": { method: "GET", path: "/quest-templates/{quest_template_id}" },
        "GET /teachers/{teacher_id}/quest-templates": { method: "GET", path: "/teachers/{teacher_id}/quest-templates" },
        "PATCH /quest-templates/{quest_template_id}": { method: "PATCH", path: "/quest-templates/{quest_template_id}" },
        "PATCH /quest-templates/{quest_template_id}/soft-delete": { method: "PATCH", path: "/quest-templates/{quest_template_id}/soft-delete" },

        // QuestQuestions
        "POST /quest-templates/{template_id}/questions": { method: "POST", path: "/quest-templates/{template_id}/questions" },
        "GET /quest-templates/{template_id}/questions": { method: "GET", path: "/quest-templates/{template_id}/questions" },
        "GET /quest-questions/{question_id}": { method: "GET", path: "/quest-questions/{question_id}" },
        "PATCH /quest-questions/{question_id}": { method: "PATCH", path: "/quest-questions/{question_id}" },
        "DELETE /quest-questions/{question_id}": { method: "DELETE", path: "/quest-questions/{question_id}" },

        // QuestQuestionResponses
        "PUT /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}": { method: "PUT", path: "/quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}" },
        "GET /quest-instances/{quest_instance_id}/responses/{student_id}": { method: "GET", path: "/quest-instances/{quest_instance_id}/responses/{student_id}" },
        "GET /quest-instances/{quest_instance_id}/responses": { method: "GET", path: "/quest-instances/{quest_instance_id}/responses" },
        "GET /students/{student_id}/responses": { method: "GET", path: "/students/{student_id}/responses" },
        "GET /questions/{question_id}/responses": { method: "GET", path: "/questions/{question_id}/responses" },
        "PATCH /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/grade": { method: "PATCH", path: "/quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/grade" },

        // BossQuestions
        "POST /boss-templates/{boss_template_id}/questions": { method: "POST", path: "/boss-templates/{boss_template_id}/questions" },
        "GET /boss-questions/{question_id}": { method: "GET", path: "/boss-questions/{question_id}" },
        "GET /boss-templates/{boss_template_id}/questions": { method: "GET", path: "/boss-templates/{boss_template_id}/questions" },
        "PATCH /boss-questions/{question_id}": { method: "PATCH", path: "/boss-questions/{question_id}" },
        "DELETE /boss-questions/{question_id}": { method: "DELETE", path: "/boss-questions/{question_id}" },

        // BossBattleTemplates
        "POST /boss-battle-templates": { method: "POST", path: "/boss-battle-templates" },
        "GET /boss-battle-templates/{boss_template_id}": { method: "GET", path: "/boss-battle-templates/{boss_template_id}" },
        "GET /teachers/{teacher_id}/boss-battle-templates": { method: "GET", path: "/teachers/{teacher_id}/boss-battle-templates" },
        "GET /boss-battle-templates/public": { method: "GET", path: "/boss-battle-templates/public" },

        // RewardTransactions
        "POST /reward-transactions": { method: "POST", path: "/reward-transactions" },
        "GET /reward-transactions/{transaction_id}": { method: "GET", path: "/reward-transactions/{transaction_id}" },
        "GET /reward-transactions/by-student/{student_id}": { method: "GET", path: "/reward-transactions/by-student/{student_id}" },
        "GET /reward-transactions/by-student/{student_id}/class/{class_id}": { method: "GET", path: "/reward-transactions/by-student/{student_id}/class/{class_id}" },
        "GET /reward-transactions/by-source/{source_type}/{source_id}": { method: "GET", path: "/reward-transactions/by-source/{source_type}/{source_id}" },

        // Internal routes for reward pipeline
        "PATCH /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/mark-reward-applied": { method: "PATCH", path: "/quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/mark-reward-applied" },
        "PATCH /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/mark-reward-reversed": { method: "PATCH", path: "/quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/mark-reward-reversed" },

        // QuestAnswerAttempts
        "POST /quest-answer-attempts": { method: "POST", path: "/quest-answer-attempts" },
        "GET /quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts": { method: "GET", path: "/quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts" },
        "GET /quest-instances/{quest_instance_id}/students/{student_id}/attempts": { method: "GET", path: "/quest-instances/{quest_instance_id}/students/{student_id}/attempts" },
        "GET /quest-instances/{quest_instance_id}/questions/{question_id}/attempts": { method: "GET", path: "/quest-instances/{quest_instance_id}/questions/{question_id}/attempts" },
        "PATCH /quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts/{attempt_no}/grade": { method: "PATCH", path: "/quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts/{attempt_no}/grade" },

        // BossBattleInstances
        "POST /boss-battle-instances": { method: "POST", path: "/boss-battle-instances" },
        "GET /boss-battle-instances/{boss_instance_id}": { method: "GET", path: "/boss-battle-instances/{boss_instance_id}" },
        "GET /classes/{class_id}/boss-battle-instances": { method: "GET", path: "/classes/{class_id}/boss-battle-instances" },
        "GET /boss-battle-templates/{boss_template_id}/boss-battle-instances": { method: "GET", path: "/boss-battle-templates/{boss_template_id}/boss-battle-instances" },
        "PATCH /boss-battle-instances/{boss_instance_id}": { method: "PATCH", path: "/boss-battle-instances/{boss_instance_id}" },

        // BossBattleParticipants
        "POST /boss-battle-instances/{boss_instance_id}/participants/join": { method: "POST", path: "/boss-battle-instances/{boss_instance_id}/participants/join" },
        "POST /boss-battle-instances/{boss_instance_id}/participants/spectate": { method: "POST", path: "/boss-battle-instances/{boss_instance_id}/participants/spectate" },
        "POST /boss-battle-instances/{boss_instance_id}/participants/leave": { method: "POST", path: "/boss-battle-instances/{boss_instance_id}/participants/leave" },
        "GET /boss-battle-instances/{boss_instance_id}/participants": { method: "GET", path: "/boss-battle-instances/{boss_instance_id}/participants" },
        "POST /boss-battle-instances/{boss_instance_id}/participants/{student_id}/kick": { method: "POST", path: "/boss-battle-instances/{boss_instance_id}/participants/{student_id}/kick" },

        // BossAnswerAttempts
        "GET /boss-battle-instances/{boss_instance_id}/attempts": { method: "GET", path: "/boss-battle-instances/{boss_instance_id}/attempts" },
        "GET /students/{student_id}/bossAttempts": { method: "GET", path: "/students/{student_id}/bossAttempts" },

        // BossResults
        "GET /boss-battle-instances/{boss_instance_id}/results": { method: "GET", path: "/boss-battle-instances/{boss_instance_id}/results" },
        "GET /students/{student_id}/bossResults": { method: "GET", path: "/students/{student_id}/bossResults" },
        "POST /boss-battle-instances/{boss_instance_id}/results/compute": { method: "POST", path: "/boss-battle-instances/{boss_instance_id}/results/compute" },

        // BossBattleSnapshots
        "POST /boss-battle-instances/{boss_instance_id}/snapshots/participants": { method: "POST", path: "/boss-battle-instances/{boss_instance_id}/snapshots/participants" },
        "GET /boss-battle-snapshots/{snapshot_id}": { method: "GET", path: "/boss-battle-snapshots/{snapshot_id}" },

        // BossBattleQuestionPlans
        "GET /boss-battle-question-plans/{plan_id}": { method: "GET", path: "/boss-battle-question-plans/{plan_id}" },
    };

    // ── ROUTER LAMBDA (replaces individual Lambdas) ──────────────────────────
    const tableArnList = Object.values(tableArns);

    const questRouter = new Function(stack, "QuestRouter", {
        handler: "packages/functions/src/quest-router/router.handler",
        environment: {
            USERS_TABLE_NAME:                          tableNames.usersTable,
            STUDENT_PROFILES_TABLE_NAME:               tableNames.studentProfilesTable,
            TEACHER_PROFILES_TABLE_NAME:               tableNames.teacherProfilesTable,
            SCHOOLS_TABLE_NAME:                        tableNames.schoolsTable,
            CLASSES_TABLE_NAME:                        tableNames.classesTable,
            CLASS_ENROLLMENTS_TABLE_NAME:              tableNames.classEnrollmentsTable,
            QUEST_TEMPLATES_TABLE_NAME:                tableNames.questTemplatesTable,
            QUEST_QUESTIONS_TABLE_NAME:                tableNames.questQuestionsTable,
            QUEST_INSTANCES_TABLE_NAME:                tableNames.questInstancesTable,
            QUEST_QUESTION_RESPONSES_TABLE_NAME:       tableNames.questQuestionResponsesTable,
            PLAYER_STATES_TABLE_NAME:                  tableNames.playerStatesTable,
            GUILDS_TABLE_NAME:                         tableNames.guildsTable,
            GUILD_MEMBERSHIPS_TABLE_NAME:              tableNames.guildMembershipsTable,
            BOSS_QUESTIONS_TABLE_NAME:                 tableNames.bossQuestionsTable,
            BOSS_BATTLE_TEMPLATES_TABLE_NAME:          tableNames.bossBattleTemplatesTable,
            REWARD_TRANSACTIONS_TABLE_NAME:            tableNames.rewardTransactionsTable,
            QUEST_ANSWER_ATTEMPTS_TABLE_NAME:          tableNames.questAnswerAttemptsTable,
            BOSS_BATTLE_INSTANCES_TABLE_NAME:          tableNames.bossBattleInstancesTable,
            BOSS_BATTLE_PARTICIPANTS_TABLE_NAME:       tableNames.bossBattleParticipantsTable,
            BOSS_ANSWER_ATTEMPTS_TABLE_NAME:           tableNames.bossAnswerAttemptsTable,
            BOSS_RESULTS_TABLE_NAME:                   tableNames.bossResultsTable,
            BOSS_BATTLE_SNAPSHOTS_TABLE_NAME:          tableNames.bossBattleSnapshotsTable,
            BOSS_BATTLE_QUESTION_PLANS_TABLE_NAME:     tableNames.bossBattleQuestionPlansTable,
            USER_POOL_ID:                              userPoolId,
            // debug-create.ts reads TABLE_NAME (non-standard); point to usersTable
            TABLE_NAME:                                tableNames.usersTable,
        },
        timeout: 30,
        memorySize: 512,
    });

    questRouter.attachPermissions([
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

    const sharedIntegration = new apigatewayv2.CfnIntegration(stack, "QuestRouterIntegration", {
        apiId,
        integrationType: "AWS_PROXY",
        integrationUri: questRouter.functionArn,
        payloadFormatVersion: "2.0",
    });

    questRouter.addPermission("QuestRouterInvokePermission", {
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

import { StackContext, Function } from "sst/constructs";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { fileURLToPath } from "url";

// SST v2 compiles stacks as ES modules — __dirname is not available.
// The SST config bundle is always emitted into the infra/ directory, so
// import.meta.url resolves to infra/.sst.config.xxx.mjs and dirname = infra/.
const _dirname = path.dirname(fileURLToPath(import.meta.url));

type AppSyncStackProps = {
    tableNames: {
        // Phase 2 read queries
        bossBattleInstancesTable: string;
        bossBattleParticipantsTable: string;
        bossQuestionsTable: string;
        // Phase 3 mutation resolver — all tables the lifecycle handlers touch
        bossBattleTemplatesTable: string;
        bossBattleQuestionPlansTable: string;
        bossBattleSnapshotsTable: string;
        bossAnswerAttemptsTable: string;
        bossResultsTable: string;
        playerStatesTable: string;
        rewardTransactionsTable: string;
    };
    tableArns: {
        bossBattleInstancesTable: string;
        bossBattleParticipantsTable: string;
        bossQuestionsTable: string;
        bossBattleTemplatesTable: string;
        bossBattleQuestionPlansTable: string;
        bossBattleSnapshotsTable: string;
        bossAnswerAttemptsTable: string;
        bossResultsTable: string;
        playerStatesTable: string;
        rewardTransactionsTable: string;
    };
    userPoolId: string;
};

/**
 * AppSyncStack — AppSync GraphQL API as the realtime delivery layer for Boss Battles.
 *
 * Phase 3: full mutation surface + subscription publishing.
 *   - mutation-resolver Lambda: dispatches all 11 lifecycle mutations to existing
 *     handler logic; calls publish-event.ts after each success
 *   - publishBattleStateChanged / publishRosterChanged fire subscription events
 *     to all connected WebSocket clients
 *   - REST routes in QuestApiStack remain active in parallel throughout Phase 3–4
 */
export function AppSyncStack(ctx: StackContext, props: AppSyncStackProps) {
    const { stack } = ctx;

    // Import the Cognito UserPool by ID (created in AuthStack)
    const userPool = cognito.UserPool.fromUserPoolId(
        stack,
        "UserPoolRef",
        props.userPoolId
    );

    // ──────────────────────────────────────────────────────────────────────────
    // AppSync GraphQL API
    // ──────────────────────────────────────────────────────────────────────────

    const graphqlApi = new appsync.GraphqlApi(stack, "BossBattleApi", {
        name: `${stack.stackName}-BossBattleGraphQL`,
        definition: appsync.Definition.fromFile(
            path.join(_dirname, "graphql/schema.graphql")
        ),
        authorizationConfig: {
            // Primary: Cognito USER_POOLS — same JWT Amplify already issues
            defaultAuthorization: {
                authorizationType: appsync.AuthorizationType.USER_POOL,
                userPoolConfig: { userPool },
            },
            additionalAuthorizationModes: [
                {
                    // API_KEY — required for WebSocket subscription handshake
                    authorizationType: appsync.AuthorizationType.API_KEY,
                    apiKeyConfig: {
                        description: "Boss Battle AppSync API Key",
                        expires: cdk.Expiration.after(cdk.Duration.days(365)),
                    },
                },
                {
                    // IAM — used by the mutation resolver Lambda to call internal publish mutations
                    authorizationType: appsync.AuthorizationType.IAM,
                },
            ],
        },
        logConfig: {
            fieldLogLevel: appsync.FieldLogLevel.ERROR,
            excludeVerboseContent: true,
        },
    });

    // ──────────────────────────────────────────────────────────────────────────
    // DynamoDB data sources (read model — Phases 1–2)
    // ──────────────────────────────────────────────────────────────────────────

    const bbiDS = graphqlApi.addDynamoDbDataSource(
        "BossBattleInstancesDS",
        dynamodb.Table.fromTableArn(stack, "BossBattleInstancesRef", props.tableArns.bossBattleInstancesTable)
    );

    const bbpDS = graphqlApi.addDynamoDbDataSource(
        "BossBattleParticipantsDS",
        dynamodb.Table.fromTableArn(stack, "BossBattleParticipantsRef", props.tableArns.bossBattleParticipantsTable)
    );

    const bqDS = graphqlApi.addDynamoDbDataSource(
        "BossQuestionsDS",
        dynamodb.Table.fromTableArn(stack, "BossQuestionsRef", props.tableArns.bossQuestionsTable)
    );

    // NONE data source — subscription filter resolvers + publish mutation passthroughs
    const noneDS = graphqlApi.addNoneDataSource("NoneDS");

    // ──────────────────────────────────────────────────────────────────────────
    // Mutation resolver Lambda (Phase 3)
    // ──────────────────────────────────────────────────────────────────────────

    const allTableArns = Object.values(props.tableArns);

    const mutationResolverFn = new Function(stack, "BossMutationResolver", {
        handler: "packages/functions/src/boss-appsync-resolvers/mutation-resolver.handler",
        environment: {
            BOSS_BATTLE_INSTANCES_TABLE_NAME:    props.tableNames.bossBattleInstancesTable,
            BOSS_BATTLE_PARTICIPANTS_TABLE_NAME: props.tableNames.bossBattleParticipantsTable,
            BOSS_QUESTIONS_TABLE_NAME:           props.tableNames.bossQuestionsTable,
            BOSS_BATTLE_TEMPLATES_TABLE_NAME:    props.tableNames.bossBattleTemplatesTable,
            BOSS_BATTLE_QUESTION_PLANS_TABLE_NAME: props.tableNames.bossBattleQuestionPlansTable,
            BOSS_BATTLE_SNAPSHOTS_TABLE_NAME:    props.tableNames.bossBattleSnapshotsTable,
            BOSS_ANSWER_ATTEMPTS_TABLE_NAME:     props.tableNames.bossAnswerAttemptsTable,
            BOSS_RESULTS_TABLE_NAME:             props.tableNames.bossResultsTable,
            PLAYER_STATES_TABLE_NAME:            props.tableNames.playerStatesTable,
            REWARD_TRANSACTIONS_TABLE_NAME:      props.tableNames.rewardTransactionsTable,
            // AppSync URL is set after the API is created — injected below
            APPSYNC_API_URL:                     graphqlApi.graphqlUrl,
        },
        timeout: 30,
        memorySize: 512,
    });

    // DynamoDB permissions for all boss battle tables
    mutationResolverFn.attachPermissions([
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
                ...allTableArns,
                ...allTableArns.map((arn) => `${arn}/index/*`),
            ],
        }),
        // Permission to call the internal publishBattleStateChanged / publishRosterChanged mutations
        new iam.PolicyStatement({
            actions: ["appsync:GraphQL"],
            resources: [`${graphqlApi.arn}/types/Mutation/*`],
        }),
    ]);

    // Lambda data source for all 11 lifecycle mutations
    const mutationDS = graphqlApi.addLambdaDataSource(
        "MutationResolverDS",
        mutationResolverFn
    );

    // ──────────────────────────────────────────────────────────────────────────
    // Query resolvers (Phases 1–2)
    // ──────────────────────────────────────────────────────────────────────────

    bbiDS.createResolver("GetBossBattleInstanceResolver", {
        typeName: "Query",
        fieldName: "getBossBattleInstance",
        requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem(
            "boss_instance_id",
            "bossInstanceId"
        ),
        responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    bbiDS.createResolver("ListBossBattleInstancesByClassResolver", {
        typeName: "Query",
        fieldName: "listBossBattleInstancesByClass",
        requestMappingTemplate: appsync.MappingTemplate.dynamoDbQuery(
            appsync.KeyCondition.eq("class_id", "classId"),
            "gsi1"
        ),
        responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
    });

    bbpDS.createResolver("GetBossBattleParticipantsResolver", {
        typeName: "Query",
        fieldName: "getBossBattleParticipants",
        requestMappingTemplate: appsync.MappingTemplate.dynamoDbQuery(
            appsync.KeyCondition.eq("boss_instance_id", "bossInstanceId")
        ),
        responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
    });

    // getActiveBossQuestion — JS resolver: GetItem + strip correct_answer for Students group
    bqDS.createResolver("GetActiveBossQuestionResolver", {
        typeName: "Query",
        fieldName: "getActiveBossQuestion",
        runtime: appsync.FunctionRuntime.JS_1_0_0,
        code: appsync.Code.fromInline(`
import { util } from "@aws-appsync/utils";

export function request(ctx) {
  return {
    operation: "GetItem",
    key: {
      question_id: util.dynamodb.toDynamoDB(ctx.args.questionId),
    },
  };
}

export function response(ctx) {
  const item = ctx.result;
  if (!item) return null;

  // Strip correct_answer for Students group — teachers and TeachersPending retain it.
  const groups = (ctx.identity && ctx.identity.claims && ctx.identity.claims["cognito:groups"]) || [];
  const isStudentCaller =
    groups.includes("Students") ||
    (!groups.includes("Teachers") && !groups.includes("TeachersPending"));

  if (isStudentCaller) {
    const { correct_answer, ...filtered } = item;
    return filtered;
  }
  return item;
}
        `),
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Mutation resolvers — lifecycle mutations wired to mutation resolver Lambda
    // ──────────────────────────────────────────────────────────────────────────

    const lifecycleMutations = [
        "startBattle",
        "startCountdown",
        "startQuestion",
        "submitAnswer",
        "resolveQuestion",
        "advanceQuestion",
        "finishBattle",
        "joinBattle",
        "spectateBattle",
        "leaveBattle",
        "kickParticipant",
    ] as const;

    for (const fieldName of lifecycleMutations) {
        mutationDS.createResolver(`${capitalize(fieldName)}MutationResolver`, {
            typeName: "Mutation",
            fieldName,
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal publish mutations — NONE data source (passthrough to subscriptions)
    // ──────────────────────────────────────────────────────────────────────────

    noneDS.createResolver("PublishBattleStateChangedResolver", {
        typeName: "Mutation",
        fieldName: "publishBattleStateChanged",
        runtime: appsync.FunctionRuntime.JS_1_0_0,
        code: appsync.Code.fromInline(`
export function request(ctx) {
  return { payload: null };
}

export function response(ctx) {
  // Return input directly — AppSync uses this to trigger onBattleStateChanged subscriptions.
  return ctx.args.input;
}
        `),
    });

    noneDS.createResolver("PublishRosterChangedResolver", {
        typeName: "Mutation",
        fieldName: "publishRosterChanged",
        runtime: appsync.FunctionRuntime.JS_1_0_0,
        code: appsync.Code.fromInline(`
export function request(ctx) {
  return { payload: null };
}

export function response(ctx) {
  return {
    boss_instance_id: ctx.args.bossInstanceId,
    participants: ctx.args.participants,
  };
}
        `),
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Subscription resolvers — enhanced filtering by bossInstanceId (Phase 2)
    // ──────────────────────────────────────────────────────────────────────────

    noneDS.createResolver("OnBattleStateChangedResolver", {
        typeName: "Subscription",
        fieldName: "onBattleStateChanged",
        runtime: appsync.FunctionRuntime.JS_1_0_0,
        code: appsync.Code.fromInline(`
import { extensions } from "@aws-appsync/utils";

export function request(ctx) {
  extensions.setSubscriptionFilter(
    util.transform.toSubscriptionFilter({
      filterGroup: [
        {
          filters: [
            {
              fieldName: "boss_instance_id",
              operator: "eq",
              value: ctx.args.bossInstanceId,
            },
          ],
        },
      ],
    })
  );
  return {};
}

export function response(ctx) {
  return ctx.result;
}
        `),
    });

    noneDS.createResolver("OnRosterChangedResolver", {
        typeName: "Subscription",
        fieldName: "onRosterChanged",
        runtime: appsync.FunctionRuntime.JS_1_0_0,
        code: appsync.Code.fromInline(`
import { extensions } from "@aws-appsync/utils";

export function request(ctx) {
  extensions.setSubscriptionFilter(
    util.transform.toSubscriptionFilter({
      filterGroup: [
        {
          filters: [
            {
              fieldName: "boss_instance_id",
              operator: "eq",
              value: ctx.args.bossInstanceId,
            },
          ],
        },
      ],
    })
  );
  return {};
}

export function response(ctx) {
  return ctx.result;
}
        `),
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Stack outputs
    // ──────────────────────────────────────────────────────────────────────────

    stack.addOutputs({
        AppSyncApiUrl: graphqlApi.graphqlUrl,
        AppSyncApiKey: graphqlApi.apiKey ?? "(no key)",
        AppSyncApiArn: graphqlApi.arn,
    });

    return {
        graphqlUrl:    graphqlApi.graphqlUrl,
        apiKey:        graphqlApi.apiKey,
        graphqlApiArn: graphqlApi.arn,
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

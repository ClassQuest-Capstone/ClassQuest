import { StackContext } from "sst/constructs";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { fileURLToPath } from "url";

// SST v2 compiles stacks as ES modules — __dirname is not available.
// The SST config bundle is always emitted into the infra/ directory, so
// import.meta.url resolves to infra/.sst.config.xxx.mjs and dirname = infra/.
const _dirname = path.dirname(fileURLToPath(import.meta.url));

type AppSyncStackProps = {
    tableNames: {
        bossBattleInstancesTable: string;
        bossBattleParticipantsTable: string;
        bossQuestionsTable: string;
    };
    tableArns: {
        bossBattleInstancesTable: string;
        bossBattleParticipantsTable: string;
        bossQuestionsTable: string;
    };
    userPoolId: string;
};

/**
 * AppSyncStack — adds an AppSync GraphQL API as the realtime delivery layer
 * for the Boss Battle system.
 *
 * Phase 2: full read model + subscription skeleton.
 *   - All 4 MVP queries wired with direct DDB resolvers
 *   - getActiveBossQuestion strips correct_answer for Students group (JS resolver)
 *   - onBattleStateChanged + onRosterChanged subscriptions open WebSocket connections
 *   - publishBattleStateChanged + publishRosterChanged wired to NONE data source
 *     (no events fire until Phase 3 wires the mutation resolver Lambda)
 *
 * This stack does NOT modify any existing Lambda handlers or REST routes.
 * All REST endpoints in QuestApiStack remain active in parallel.
 */
export function AppSyncStack(ctx: StackContext, props: AppSyncStackProps) {
    const { stack } = ctx;

    // Import the Cognito UserPool by ID (created in AuthStack)
    const userPool = cognito.UserPool.fromUserPoolId(
        stack,
        "UserPoolRef",
        props.userPoolId
    );

    // Create the AppSync GraphQL API
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
            // Secondary: API_KEY — required for WebSocket subscription handshake
            additionalAuthorizationModes: [
                {
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
        // Log resolver errors to CloudWatch (not all fields — keeps costs down)
        logConfig: {
            fieldLogLevel: appsync.FieldLogLevel.ERROR,
            excludeVerboseContent: true,
        },
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Data sources
    // ──────────────────────────────────────────────────────────────────────────

    // BossBattleInstances — GetItem + Query (by PK and GSI1)
    const bossBattleInstancesTable = dynamodb.Table.fromTableArn(
        stack,
        "BossBattleInstancesRef",
        props.tableArns.bossBattleInstancesTable
    );
    const bbiDS = graphqlApi.addDynamoDbDataSource(
        "BossBattleInstancesDS",
        bossBattleInstancesTable
    );

    // BossBattleParticipants — Query by PK (boss_instance_id)
    const bossBattleParticipantsTable = dynamodb.Table.fromTableArn(
        stack,
        "BossBattleParticipantsRef",
        props.tableArns.bossBattleParticipantsTable
    );
    const bbpDS = graphqlApi.addDynamoDbDataSource(
        "BossBattleParticipantsDS",
        bossBattleParticipantsTable
    );

    // BossQuestions — GetItem by PK (question_id); JS resolver filters correct_answer for Students
    const bossQuestionsTable = dynamodb.Table.fromTableArn(
        stack,
        "BossQuestionsRef",
        props.tableArns.bossQuestionsTable
    );
    const bqDS = graphqlApi.addDynamoDbDataSource(
        "BossQuestionsDS",
        bossQuestionsTable
    );

    // NONE data source — used for subscription filter resolvers and publish mutation passthroughs
    const noneDS = graphqlApi.addNoneDataSource("NoneDS");

    // ──────────────────────────────────────────────────────────────────────────
    // Query resolvers
    // ──────────────────────────────────────────────────────────────────────────

    // getBossBattleInstance — GetItem by PK (boss_instance_id)
    bbiDS.createResolver("GetBossBattleInstanceResolver", {
        typeName: "Query",
        fieldName: "getBossBattleInstance",
        requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem(
            "boss_instance_id", // DynamoDB partition key attribute name
            "bossInstanceId"    // GraphQL argument name
        ),
        responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    // listBossBattleInstancesByClass — GSI1 Query (class_id PK, created_at SK, ascending)
    bbiDS.createResolver("ListBossBattleInstancesByClassResolver", {
        typeName: "Query",
        fieldName: "listBossBattleInstancesByClass",
        requestMappingTemplate: appsync.MappingTemplate.dynamoDbQuery(
            appsync.KeyCondition.eq("class_id", "classId"),
            "gsi1"
        ),
        responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
    });

    // getBossBattleParticipants — Query on primary index by boss_instance_id PK
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
    // Mutation resolvers — internal publish mutations (NONE data source passthrough)
    // Phase 3 will add the Lambda mutation resolver that calls these via SigV4 HTTP.
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
  // Return the input directly — AppSync uses this to trigger onBattleStateChanged subscriptions.
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
  // Return the roster payload — triggers onRosterChanged subscriptions.
  return {
    boss_instance_id: ctx.args.bossInstanceId,
    participants: ctx.args.participants,
  };
}
        `),
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Subscription resolvers — JS enhanced filtering by bossInstanceId
    // WebSocket connections open here; events fire in Phase 3 once the Lambda
    // mutation resolver calls publishBattleStateChanged / publishRosterChanged.
    // ──────────────────────────────────────────────────────────────────────────

    noneDS.createResolver("OnBattleStateChangedResolver", {
        typeName: "Subscription",
        fieldName: "onBattleStateChanged",
        runtime: appsync.FunctionRuntime.JS_1_0_0,
        code: appsync.Code.fromInline(`
import { extensions } from "@aws-appsync/utils";

export function request(ctx) {
  // Apply enhanced subscription filter so only events matching this bossInstanceId
  // are delivered to this subscriber.
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
    });

    return {
        graphqlUrl: graphqlApi.graphqlUrl,
        apiKey: graphqlApi.apiKey,
        graphqlApiArn: graphqlApi.arn,
    };
}

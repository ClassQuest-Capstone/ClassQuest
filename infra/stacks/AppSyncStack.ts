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
    };
    tableArns: {
        bossBattleInstancesTable: string;
    };
    userPoolId: string;
};

/**
 * AppSyncStack — adds an AppSync GraphQL API as the realtime delivery layer
 * for the Boss Battle system.
 *
 * Phase 1: foundation only.
 *   - Cognito USER_POOLS as primary auth + API_KEY as secondary
 *   - BossBattleInstances DynamoDB data source
 *   - getBossBattleInstance direct DDB resolver (GetItem by PK)
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
            ],
        },
        // Log resolver errors to CloudWatch (not all fields — keeps costs down)
        logConfig: {
            fieldLogLevel: appsync.FieldLogLevel.ERROR,
            excludeVerboseContent: true,
        },
    });

    // Import the BossBattleInstances DynamoDB table by ARN
    const bossBattleInstancesTable = dynamodb.Table.fromTableArn(
        stack,
        "BossBattleInstancesRef",
        props.tableArns.bossBattleInstancesTable
    );

    // Register the DynamoDB data source (CDK grants GetItem/PutItem/Query automatically)
    const bbiDataSource = graphqlApi.addDynamoDbDataSource(
        "BossBattleInstancesDS",
        bossBattleInstancesTable
    );

    // Wire getBossBattleInstance → direct DynamoDB GetItem resolver
    // Resolver: Query.getBossBattleInstance(bossInstanceId: ID!) → GetItem on boss_instance_id PK
    bbiDataSource.createResolver("GetBossBattleInstanceResolver", {
        typeName: "Query",
        fieldName: "getBossBattleInstance",
        requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem(
            "boss_instance_id", // DynamoDB partition key attribute name
            "bossInstanceId"    // GraphQL argument name
        ),
        responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    stack.addOutputs({
        AppSyncApiUrl: graphqlApi.graphqlUrl,
        AppSyncApiKey: graphqlApi.apiKey ?? "(no key)",
    });

    return {
        graphqlUrl: graphqlApi.graphqlUrl,
        apiKey: graphqlApi.apiKey,
    };
}

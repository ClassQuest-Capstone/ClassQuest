import { StackContext, Bucket, Table, Api } from "sst/constructs";

export function ClassQuestStack({ stack }: StackContext) {
    const assetsBucket = new Bucket(stack, "Assets");

    const gameTable = new Table(stack, "GameTable", {
        fields: {
            pk: "string",
            sk: "string",
            gsi1pk: "string",
            gsi1sk: "string",
        },
        primaryIndex: { partitionKey: "pk", sortKey: "sk" },
        globalIndexes: {
            gsi1: { partitionKey: "gsi1pk", sortKey: "gsi1sk" },
        },
    });

    // Users table
    const usersTable = new Table(stack, "Users", {
        fields: {
            user_id: "string",
            cognito_sub: "string",
            role: "string",
            status: "string",
            created_at: "string",
            last_login_at: "string",
        },
        primaryIndex: { partitionKey: "user_id" },
        globalIndexes: {
        // Lookup by Cognito ID (cognito_sub)
        gsi1: { partitionKey: "cognito_sub" },
        },
    });


    const api = new Api(stack, "HttpApi", {
        routes: {
            "GET /health": "functions/src/health.handler",
            "POST /debug": "functions/src/debug-create.handler",
        },
        defaults: {
            function: {
                environment: {
                    TABLE_NAME: gameTable.tableName,
                },
            },
        },
    });

    api.attachPermissions([gameTable, usersTable]);

    stack.addOutputs({
        AssetsBucketName: assetsBucket.bucketName,
        GameTableName: gameTable.tableName,
        UsersTableName: usersTable.tableName,
        ApiUrl: api.url,
    });
}

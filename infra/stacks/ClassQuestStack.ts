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

    const api = new Api(stack, "HttpApi", {
        routes: {
            "GET /health": "functions/src/health.handler",
            "POST /debug": "packages/functions/src/debug-create.handler",
        },
        defaults: {
            function: {
                environment: {
                    TABLE_NAME: gameTable.tableName,
                },
            },
        },
    });

    api.attachPermissions([gameTable]);

    stack.addOutputs({
        AssetsBucketName: assetsBucket.bucketName,
        GameTableName: gameTable.tableName,
        ApiUrl: api.url,
    });
}

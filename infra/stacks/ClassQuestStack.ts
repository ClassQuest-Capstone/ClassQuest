import { StackContext, Bucket } from "sst/constructs";
import { createTables } from "./tables";
import { createApi } from "./api";
import { createAuth } from "./auth";

export function ClassQuestStack(ctx: StackContext) {
    const { stack } = ctx;

    const assetsBucket = new Bucket(stack, "Assets");

    const { userPool, userPoolClient } = createAuth(ctx);

    const tables = createTables(ctx);
    const api = createApi(stack, tables);

    stack.addOutputs({
        ApiUrl: api.url,
        Region: stack.region,
        UserPoolId: userPool.userPoolId,
        UserPoolClientId: userPoolClient.userPoolClientId,
    });

    return { assetsBucket, userPool, userPoolClient, ...tables, api };
}

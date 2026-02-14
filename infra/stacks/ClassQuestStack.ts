import { StackContext, Bucket } from "sst/constructs";
import { createTables } from "./tables";
import { createApi } from "./api";
import { createAuth } from "./auth";

export function ClassQuestStack(ctx: StackContext) {
    const { stack } = ctx;

    const assetsBucket = new Bucket(stack, "Assets");

    const tables = createTables(ctx);

    const { userPool, userPoolClient } = createAuth(ctx, tables.usersTable);

    const api = createApi(stack, tables);

    stack.addOutputs({
        ApiUrl: api.url,
        Region: stack.region,
        UserPoolId: userPool.userPoolId,
        UserPoolClientId: userPoolClient.userPoolClientId,
        QuestQuestionResponsesTableName: tables.questQuestionResponsesTable.tableName,
        PlayerStatesTableName: tables.playerStatesTable.tableName,
        GuildsTableName: tables.guildsTable.tableName,
        GuildMembershipsTableName: tables.guildMembershipsTable.tableName,
    });

    return { assetsBucket, userPool, userPoolClient, ...tables, api };
}

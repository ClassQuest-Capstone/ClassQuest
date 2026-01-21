import { StackContext, Bucket } from "sst/constructs";
import { createTables } from "./tables";
import { createApi } from "./api";

export function ClassQuestStack(ctx: StackContext) {
    const { stack } = ctx;

    const assetsBucket = new Bucket(stack, "Assets");

    const tables = createTables(ctx);
    const api = createApi(stack, tables);

    stack.addOutputs({
        AssetsBucketName: assetsBucket.bucketName,
        UsersTableName: tables.usersTable.tableName,
        TeacherProfilesTableName: tables.teacherProfilesTable.tableName,
        StudentProfilesTableName: tables.studentProfilesTable.tableName,
        ApiUrl: api.url,
    });

    return { assetsBucket, ...tables, api };
}
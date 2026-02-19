//// <reference path="./.sst/platform/config.d.ts" />

// export default $config({
//   app(input) {
//     return {
//       name: "classquest",
//       stage: input?.stage,
//       region: "ca-central-1",
//       home: "aws",
//     };
//   },

//   async run() {
//     const bucket = new sst.aws.Bucket("Assets");

//     return {
//       assetsBucketName: bucket.name,
//     };
//   },
// });




import { SSTConfig } from "sst";
import type { StackContext } from "sst/constructs";
import { DataStack } from "./stacks/DataStack";
import { AuthStack } from "./stacks/AuthStack";
import { ApiStack } from "./stacks/ApiStack";

export default {
    config() {
        return {
        name: "classquest",
        region: "ca-central-1",
        };
    },
    stacks(app) {
        // Deploy stacks in order to avoid circular dependencies
        // Capture return values to pass between stacks

        let dataStackOutputs: ReturnType<typeof DataStack>;
        let authStackOutputs: ReturnType<typeof AuthStack>;

        // 1. DataStack - DynamoDB tables
        function ClassQuestDataStack(ctx: StackContext) {
            dataStackOutputs = DataStack(ctx);
            return dataStackOutputs;
        }
        app.stack(ClassQuestDataStack);

        // 2. AuthStack - Cognito (depends on DataStack for usersTable)
        function ClassQuestAuthStack(ctx: StackContext) {
            authStackOutputs = AuthStack(ctx, {
                usersTableName: dataStackOutputs.tableNames.usersTable,
                usersTableArn: dataStackOutputs.tableArns.usersTable,
            });
            return authStackOutputs;
        }
        app.stack(ClassQuestAuthStack);

        // 3. ApiStack - API Gateway + Lambdas (depends on DataStack and AuthStack)
        function ClassQuestApiStack(ctx: StackContext) {
            return ApiStack(ctx, {
                tableNames: dataStackOutputs.tableNames,
                tableArns: dataStackOutputs.tableArns,
                userPoolId: authStackOutputs.userPoolId,
                userPoolArn: authStackOutputs.userPoolArn,
            });
        }
        app.stack(ClassQuestApiStack);
    },
} satisfies SSTConfig;
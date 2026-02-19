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
import { ApiCoreStack } from "./stacks/ApiCoreStack";
import { TeacherApiStack } from "./stacks/TeacherApiStack";
import { StudentApiStack } from "./stacks/StudentApiStack";
import { QuestApiStack } from "./stacks/QuestApiStack";

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
        let apiCoreStackOutputs: ReturnType<typeof ApiCoreStack>;

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

        // 3. ApiCoreStack - HttpApi + Stage (base API infrastructure)
        function ClassQuestApiCoreStack(ctx: StackContext) {
            apiCoreStackOutputs = ApiCoreStack(ctx);
            return apiCoreStackOutputs;
        }
        app.stack(ClassQuestApiCoreStack);

        // 4. TeacherApiStack - Teacher domain routes (depends on ApiCore, Data, Auth)
        function ClassQuestTeacherApiStack(ctx: StackContext) {
            return TeacherApiStack(ctx, {
                apiId: apiCoreStackOutputs.apiId,
                tableNames: dataStackOutputs.tableNames,
                tableArns: dataStackOutputs.tableArns,
                userPoolId: authStackOutputs.userPoolId,
                userPoolArn: authStackOutputs.userPoolArn,
            });
        }
        app.stack(ClassQuestTeacherApiStack);

        // 5. StudentApiStack - Student domain routes (depends on ApiCore, Data, Auth)
        function ClassQuestStudentApiStack(ctx: StackContext) {
            return StudentApiStack(ctx, {
                apiId: apiCoreStackOutputs.apiId,
                tableNames: dataStackOutputs.tableNames,
                tableArns: dataStackOutputs.tableArns,
                userPoolId: authStackOutputs.userPoolId,
                userPoolArn: authStackOutputs.userPoolArn,
            });
        }
        app.stack(ClassQuestStudentApiStack);

        // 6. QuestApiStack - Quest domain routes (depends on ApiCore, Data, Auth)
        function ClassQuestQuestApiStack(ctx: StackContext) {
            return QuestApiStack(ctx, {
                apiId: apiCoreStackOutputs.apiId,
                tableNames: dataStackOutputs.tableNames,
                tableArns: dataStackOutputs.tableArns,
                userPoolId: authStackOutputs.userPoolId,
                userPoolArn: authStackOutputs.userPoolArn,
            });
        }
        app.stack(ClassQuestQuestApiStack);
    },
} satisfies SSTConfig;
// /// <reference path="./.sst/platform/config.d.ts" />

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
import { ClassQuestStack } from "./stacks/ClassQuestStack";

export default {
    config() {
        return {
        name: "classquest",
        region: "ca-central-1",
        };
    },
    stacks(app) {
        app.stack(ClassQuestStack);
    },
} satisfies SSTConfig;
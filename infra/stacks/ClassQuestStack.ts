import { StackContext, Bucket } from "sst/constructs";

export function ClassQuestStack({ stack }: StackContext) {
    const bucket = new Bucket(stack, "Assets");

    stack.addOutputs({
        AssetsBucketName: bucket.bucketName,
    });
}

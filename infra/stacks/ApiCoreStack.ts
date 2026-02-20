import { StackContext } from "sst/constructs";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import { CfnOutput } from "aws-cdk-lib";

/**
 * ApiCoreStack - Creates the base HttpApi and Stage
 * Exports apiId, apiEndpoint, and stageName for use by domain API stacks
 */
export function ApiCoreStack(ctx: StackContext) {
    const { stack } = ctx;

    // Create HttpApi with CORS configuration
    const httpApi = new apigatewayv2.CfnApi(stack, "HttpApi", {
        name: `${stack.stackName}-HttpApi`,
        protocolType: "HTTP",
        corsConfiguration: {
            allowOrigins: ["http://localhost:5000"],
            allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowHeaders: ["content-type", "authorization"],
        },
    });

    // Create default stage
    const stage = new apigatewayv2.CfnStage(stack, "HttpApiStage", {
        apiId: httpApi.ref,
        stageName: "$default",
        autoDeploy: true,
    });

    // Construct API endpoint URL
    const apiEndpoint = `https://${httpApi.ref}.execute-api.${stack.region}.amazonaws.com`;

    // Export for cross-stack references
    stack.addOutputs({
        //ApiId: httpApi.ref,
        ApiURL: apiEndpoint,
        //StageName: stage.stageName,
    });

    // Also export as CloudFormation outputs
    new CfnOutput(stack, "ApiIdOutput", {
        value: httpApi.ref,
        exportName: `${stack.stackName}-ApiId`,
    });

    new CfnOutput(stack, "ApiEndpointOutput", {
        value: apiEndpoint,
        exportName: `${stack.stackName}-ApiEndpoint`,
    });

    return {
        apiId: httpApi.ref,
        apiEndpoint,
        stageName: stage.stageName,
        apiArn: `arn:aws:apigateway:${stack.region}::/apis/${httpApi.ref}`,
    };
}

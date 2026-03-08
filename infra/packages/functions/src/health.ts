// This is a simple health check function that can be used to verify that the Lambda function is deployed and running correctly.
// It can be invoked with any HTTP client (e.g. curl, Postman) or from the browser.

import { APIGatewayProxyHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyHandlerV2 = async () => {
    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "ok" }),
    };
};
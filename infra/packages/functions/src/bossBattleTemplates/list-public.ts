import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listPublic } from "./repo.ts";

/**
 * GET /boss-battle-templates/public?subject=&limit=&cursor=
 * List public boss battle templates with optional subject filter and pagination
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        // Parse query parameters
        const subject = event.queryStringParameters?.subject;
        const limit = event.queryStringParameters?.limit
            ? parseInt(event.queryStringParameters.limit, 10)
            : undefined;
        const cursor = event.queryStringParameters?.cursor;

        // Validate limit
        if (limit !== undefined && (isNaN(limit) || limit <= 0 || limit > 100)) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "limit must be a positive integer between 1 and 100",
                }),
            };
        }

        const result = await listPublic({
            subjectPrefix: subject,
            limit,
            cursor,
        });

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error listing public boss battle templates:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: error.message || "Internal server error",
            }),
        };
    }
};

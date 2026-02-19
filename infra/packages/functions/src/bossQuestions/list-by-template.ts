import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listByTemplate } from "./repo.ts";

/**
 * GET /boss-templates/{boss_template_id}/questions?limit=&cursor=
 * List all questions for a boss template, ordered by order_key, with pagination
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const boss_template_id = event.pathParameters?.boss_template_id;

        if (!boss_template_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing boss_template_id in path" }),
            };
        }

        // Parse query parameters for pagination
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

        const result = await listByTemplate(boss_template_id, limit, cursor);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error listing boss questions:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: error.message || "Internal server error",
            }),
        };
    }
};

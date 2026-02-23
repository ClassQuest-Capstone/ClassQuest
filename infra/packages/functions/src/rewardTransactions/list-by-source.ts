import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { listBySource } from "./repo.js";

/**
 * GET /reward-transactions/by-source/{source_type}/{source_id}
 * List all transactions for a specific source (e.g., quest instance, boss battle)
 *
 * Authorization: TEACHER, ADMIN, SYSTEM only (students should not have access to this endpoint)
 *
 * Query params:
 *   - limit: number of items to return (optional)
 *   - cursor: pagination cursor (optional)
 */
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
        const source_type = event.pathParameters?.source_type;
        const source_id = event.pathParameters?.source_id;

        if (!source_type || !source_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing source_type or source_id path parameter" }),
            };
        }

        // Authorization: Only teachers, admins, or system can query by source
        const userRole = event.requestContext.authorizer?.jwt?.claims?.["cognito:groups"] as string | undefined;
        const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;

        if (!userId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized: Missing user identity" }),
            };
        }

        const allowedRoles = ["Teachers", "Admins", "System"];
        const hasPermission = userRole?.split(",").some(role => allowedRoles.includes(role.trim()));

        if (!hasPermission) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Forbidden: Only teachers, admins, or system can query by source" }),
            };
        }

        // Extract pagination params
        const limit = event.queryStringParameters?.limit
            ? parseInt(event.queryStringParameters.limit, 10)
            : undefined;
        const cursor = event.queryStringParameters?.cursor;

        // Query transactions
        const result = await listBySource(source_type, source_id, limit, cursor);

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error listing transactions by source:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

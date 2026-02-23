import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { queryByGSI2 } from "./repo.js";

/**
 * GET /quest-instances/{quest_instance_id}/questions/{question_id}/attempts
 * List all attempts for a question within a quest instance (analytics for teachers)
 *
 * Authorization: teacher, admin only
 */
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
        const quest_instance_id = event.pathParameters?.quest_instance_id;
        const question_id = event.pathParameters?.question_id;

        if (!quest_instance_id || !question_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing required path parameters" }),
            };
        }

        // Authorization: Only teachers and admins can access this endpoint
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
                body: JSON.stringify({ error: "Forbidden: Only teachers and admins can access this endpoint" }),
            };
        }

        // Extract pagination params
        const limit = event.queryStringParameters?.limit
            ? parseInt(event.queryStringParameters.limit, 10)
            : undefined;
        const cursor = event.queryStringParameters?.cursor;

        // Query attempts using GSI2
        const result = await queryByGSI2(quest_instance_id, question_id, limit, cursor);

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error listing quest answer attempts by question in instance:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { queryByGSI1 } from "./repo.js";

/**
 * GET /quest-instances/{quest_instance_id}/students/{student_id}/attempts
 * List all attempts by a student within a quest instance (across all questions)
 *
 * Authorization: student (self only), teacher, admin
 */
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
        const quest_instance_id = event.pathParameters?.quest_instance_id;
        const student_id = event.pathParameters?.student_id;

        if (!quest_instance_id || !student_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing required path parameters" }),
            };
        }

        // Authorization: Students can only view their own attempts
        const userRole = event.requestContext.authorizer?.jwt?.claims?.["cognito:groups"] as string | undefined;
        const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;

        if (!userId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized: Missing user identity" }),
            };
        }

        const isStudent = userRole?.includes("Students");
        if (isStudent && student_id !== userId) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Forbidden: You can only view your own attempts" }),
            };
        }

        // Extract pagination params
        const limit = event.queryStringParameters?.limit
            ? parseInt(event.queryStringParameters.limit, 10)
            : undefined;
        const cursor = event.queryStringParameters?.cursor;

        // Query attempts using GSI1
        const result = await queryByGSI1(quest_instance_id, student_id, limit, cursor);

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error listing quest answer attempts by student in instance:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

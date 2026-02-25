import { queryByPK } from "./repo.js";

/**
 * GET /quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts
 * List all attempts for a specific (quest_instance, student, question) combination
 *
 * Authorization: student (self only), teacher, admin
 */
export const handler = async (event: any) => {
    try {
        const quest_instance_id = event.pathParameters?.quest_instance_id;
        const student_id = event.pathParameters?.student_id;
        const question_id = event.pathParameters?.question_id;

        if (!quest_instance_id || !student_id || !question_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing required path parameters" }),
            };
        }

        // Authorization: Students can only view their own attempts
        const userRole = event.requestContext?.authorizer?.jwt?.claims?.["cognito:groups"] as string | undefined;
        const userId = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined;

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

        // Query attempts
        const result = await queryByPK(quest_instance_id, student_id, question_id, limit, cursor);

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error listing quest answer attempts by PK:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

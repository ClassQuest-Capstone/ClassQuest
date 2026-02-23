import { listByStudent } from "./repo.js";

/**
 * GET /reward-transactions/by-student/{student_id}
 * List all transactions for a student (across all classes)
 *
 * Authorization: TEACHER, ADMIN, SYSTEM, or the student themselves
 *
 * Query params:
 *   - limit: number of items to return (optional)
 *   - cursor: pagination cursor (optional)
 */
export const handler = async (event: any) => {
    try {
        const student_id = event.pathParameters?.student_id;

        if (!student_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing student_id path parameter" }),
            };
        }

        // Authorization: Students can only list their own transactions
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
                body: JSON.stringify({ error: "Forbidden: You can only view your own transactions" }),
            };
        }

        // Extract pagination params
        const limit = event.queryStringParameters?.limit
            ? parseInt(event.queryStringParameters.limit, 10)
            : undefined;
        const cursor = event.queryStringParameters?.cursor;

        // Query transactions
        const result = await listByStudent(student_id, limit, cursor);

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error listing transactions by student:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

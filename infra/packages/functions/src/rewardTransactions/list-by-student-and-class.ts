import { listByStudentAndClass } from "./repo.js";

/**
 * GET /reward-transactions/by-student/{student_id}/class/{class_id}
 * List all transactions for a student in a specific class
 *
 * Authorization: TEACHER (of that class), ADMIN, SYSTEM, or the student themselves
 *
 * Query params:
 *   - limit: number of items to return (optional)
 *   - cursor: pagination cursor (optional)
 */
export const handler = async (event: any) => {
    try {
        const student_id = event.pathParameters?.student_id;
        const class_id = event.pathParameters?.class_id;

        if (!student_id || !class_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing student_id or class_id path parameter" }),
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

        // Note: Additional authorization check for teachers (verify they own the class) would go here
        // This would require fetching the class and checking created_by_teacher_id === userId

        // Extract pagination params
        const limit = event.queryStringParameters?.limit
            ? parseInt(event.queryStringParameters.limit, 10)
            : undefined;
        const cursor = event.queryStringParameters?.cursor;

        // Query transactions
        const result = await listByStudentAndClass(student_id, class_id, limit, cursor);

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error listing transactions by student and class:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

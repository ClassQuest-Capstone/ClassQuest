/**
 * GET /students/{student_id}/bossAttempts
 * List all attempts by a student (same student or teacher/admin)
 */

import { listAttemptsByStudent } from "./repo.js";

export const handler = async (event: any) => {
    try {
        const studentId = event.pathParameters?.student_id;
        if (!studentId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "student_id is required" }),
            };
        }

        // TODO: Authorization check - ensure requester is same student or teacher/admin
        // For now, we'll allow the request

        // Parse query parameters
        const limit = event.queryStringParameters?.limit
            ? parseInt(event.queryStringParameters.limit, 10)
            : undefined;
        const nextToken = event.queryStringParameters?.cursor;

        // List attempts
        const result = await listAttemptsByStudent(studentId, {
            limit,
            nextToken,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                items: result.items,
                nextToken: result.nextToken,
                count: result.items.length,
            }),
        };
    } catch (error: any) {
        console.error("Error listing attempts by student:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

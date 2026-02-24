/**
 * GET /students/{student_id}/bossResults
 * List student's boss battle history
 */

import { listStudentBossResults } from "./repo.js";

export const handler = async (event: any) => {
    try {
        const studentId = event.pathParameters?.student_id;
        if (!studentId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "student_id is required" }),
            };
        }

        // TODO: Authorization - same student or teacher/admin

        // Parse query parameters
        const limit = event.queryStringParameters?.limit
            ? parseInt(event.queryStringParameters.limit, 10)
            : undefined;
        const nextToken = event.queryStringParameters?.cursor;

        const result = await listStudentBossResults(studentId, {
            limit,
            nextToken,
        });

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error listing student boss results:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

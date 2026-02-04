import { listPublic } from "./repo.ts";

/**
 * GET /quest-templates/public
 * List public quest templates with optional filtering
 * Query params: subject, grade, difficulty, limit
 */
export const handler = async (event: any) => {
    // TODO AUTH: Can be public or require authentication depending on requirements

    // Extract query parameters
    const queryParams = event.queryStringParameters ?? {};
    const subject = queryParams.subject;
    const gradeStr = queryParams.grade;
    const difficulty = queryParams.difficulty;
    const limitStr = queryParams.limit;

    // Parse grade and limit as numbers
    const grade = gradeStr ? parseInt(gradeStr, 10) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;

    // Validate grade if provided
    if (gradeStr && (isNaN(grade!) || grade! < 1)) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_GRADE",
                message: "grade must be a positive integer",
            }),
        };
    }

    // Validate limit if provided
    if (limitStr && (isNaN(limit!) || limit! < 1 || limit! > 1000)) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_LIMIT",
                message: "limit must be between 1 and 1000",
            }),
        };
    }

    const items = await listPublic({ subject, grade, difficulty, limit });

    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
    };
};

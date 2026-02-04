import { listClassesByStudent } from "./repo.ts";

/**
 * GET /students/{student_id}/classes
 * List all classes a student is enrolled in
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify student_id matches authenticated user

    const student_id = event.pathParameters?.student_id;

    if (!student_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_STUDENT_ID" }),
        };
    }

    const items = await listClassesByStudent(student_id);

    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
    };
};

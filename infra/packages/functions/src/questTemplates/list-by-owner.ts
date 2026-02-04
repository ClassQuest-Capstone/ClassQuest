import { listByOwner } from "./repo.ts";

/**
 * GET /teachers/{teacher_id}/quest-templates
 * List all quest templates created by a teacher
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify teacher_id matches authenticated user

    const teacher_id = event.pathParameters?.teacher_id;

    if (!teacher_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_TEACHER_ID" }),
        };
    }

    const items = await listByOwner(teacher_id);

    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
    };
};

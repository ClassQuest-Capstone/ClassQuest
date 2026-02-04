import { listStudentsByClass } from "./repo.ts";

/**
 * GET /classes/{class_id}/students
 * List all students enrolled in a class (roster view for teachers)
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify teacher owns this class or admin in same school

    const class_id = event.pathParameters?.class_id;

    if (!class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_CLASS_ID" }),
        };
    }

    const items = await listStudentsByClass(class_id);

    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
    };
};

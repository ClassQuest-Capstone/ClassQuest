import { listStudentsByClass } from "./repo.ts";

const VALID_STATUSES = ["active", "dropped", "all"] as const;
type StatusFilter = typeof VALID_STATUSES[number];

/**
 * GET /classes/{class_id}/students
 * List enrollments for a class.
 *
 * Query params:
 *   ?status=active  (default) — active students only
 *   ?status=dropped            — dropped students only
 *   ?status=all                — all enrollments
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

    const statusParam = event.queryStringParameters?.status ?? "active";

    if (!VALID_STATUSES.includes(statusParam as StatusFilter)) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_STATUS",
                message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
            }),
        };
    }

    const items = await listStudentsByClass(class_id, statusParam as StatusFilter);

    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items, status: statusParam }),
    };
};

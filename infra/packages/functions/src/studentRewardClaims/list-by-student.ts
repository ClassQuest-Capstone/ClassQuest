import { listStudentRewardClaimsByStudentAndClass } from "./repo.ts";
import { CLAIM_STATUSES } from "./keys.ts";
import type { ClaimStatus } from "./keys.ts";

/**
 * GET /student/classes/{class_id}/reward-claims
 * List all reward claims for the authenticated student in a class.
 *
 * TODO: verify authenticated student matches student_id
 * TODO: verify student belongs to class_id
 *
 * Query params:
 *   student_id=xxx     — required until auth is implemented
 *   status=AVAILABLE   — optional status filter
 */
export const handler = async (event: any) => {
    const class_id = event.pathParameters?.class_id;
    if (!class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_CLASS_ID" }),
        };
    }

    // TODO: replace with JWT claim once auth is implemented
    const student_id = event.queryStringParameters?.student_id;
    if (!student_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_STUDENT_ID",
                message: "student_id query parameter is required",
            }),
        };
    }

    const rawStatus = event.queryStringParameters?.status as ClaimStatus | undefined;
    if (rawStatus && !CLAIM_STATUSES.includes(rawStatus)) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_STATUS",
                message: `status must be one of: ${CLAIM_STATUSES.join(", ")}`,
            }),
        };
    }

    try {
        const items = await listStudentRewardClaimsByStudentAndClass(
            student_id,
            class_id,
            rawStatus ? { status: rawStatus } : undefined
        );
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items }),
        };
    } catch (err: any) {
        console.error("Error listing student reward claims:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

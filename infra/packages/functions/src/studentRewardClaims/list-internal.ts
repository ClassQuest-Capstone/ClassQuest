import {
    listStudentRewardClaimsByStudent,
    listStudentRewardClaimsByStudentAndClass,
} from "./repo.ts";
import { CLAIM_STATUSES } from "./keys.ts";
import type { ClaimStatus } from "./keys.ts";

/**
 * GET /internal/students/{student_id}/reward-claims
 * Internal listing of all claims for one student.
 *
 * TODO: verify internal routes are admin-only
 *
 * Query params:
 *   class_id=xxx   — optional class filter
 *   status=xxx     — optional status filter
 */
export const handler = async (event: any) => {
    // TODO: verify internal routes are admin-only

    const student_id = event.pathParameters?.student_id;
    if (!student_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_STUDENT_ID" }),
        };
    }

    const class_id = event.queryStringParameters?.class_id;
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
        const statusFilter = rawStatus ? { status: rawStatus } : undefined;
        const items = class_id
            ? await listStudentRewardClaimsByStudentAndClass(student_id, class_id, statusFilter)
            : await listStudentRewardClaimsByStudent(student_id, statusFilter);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items }),
        };
    } catch (err: any) {
        console.error("Error listing student reward claims (internal):", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

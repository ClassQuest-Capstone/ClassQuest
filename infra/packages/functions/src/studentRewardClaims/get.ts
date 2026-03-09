import { getStudentRewardClaimById } from "./repo.ts";

/**
 * GET /internal/student-reward-claims/{claim_id}
 * Retrieve one claim row by ID.
 *
 * TODO: verify internal routes are admin-only
 */
export const handler = async (event: any) => {
    // TODO: verify internal routes are admin-only

    const claim_id = event.pathParameters?.claim_id;
    if (!claim_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_CLAIM_ID" }),
        };
    }

    try {
        const claim = await getStudentRewardClaimById(claim_id);
        if (!claim) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "CLAIM_NOT_FOUND" }),
            };
        }
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(claim),
        };
    } catch (err: any) {
        console.error("Error getting student reward claim:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

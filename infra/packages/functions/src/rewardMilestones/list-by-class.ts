import { listRewardMilestonesByClass } from "./repo.ts";

/**
 * GET /teacher/classes/{class_id}/rewards
 * List all reward milestones for a class, sorted by unlock level (GSI1).
 * Returns both active and inactive rewards; excludes soft-deleted by default.
 *
 * Query params:
 *   include_deleted=true  — also return soft-deleted rewards
 */
export const handler = async (event: any) => {
    // TODO: verify teacher authorization — confirm the caller manages this class

    const class_id = event.pathParameters?.class_id;
    if (!class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_CLASS_ID" }),
        };
    }

    const includeDeleted =
        event.queryStringParameters?.include_deleted === "true";

    try {
        const items = await listRewardMilestonesByClass(class_id, { includeDeleted });
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items }),
        };
    } catch (err: any) {
        console.error("Error listing rewards by class:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

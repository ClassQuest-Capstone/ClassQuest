import { listRewardMilestonesByTeacher } from "./repo.ts";

/**
 * GET /teacher/rewards
 * List all reward milestones created by a teacher, across all classes (GSI2).
 *
 * Query params:
 *   teacher_id=xxx        — required until auth is implemented
 *   include_deleted=true  — also return soft-deleted rewards
 *
 * TODO: once auth is implemented, teacher_id will come from the JWT token;
 *       remove the query param requirement.
 */
export const handler = async (event: any) => {
    // TODO: verify teacher authorization — replace teacher_id query param with JWT claim

    const teacher_id = event.queryStringParameters?.teacher_id;
    if (!teacher_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_TEACHER_ID",
                message: "teacher_id query parameter is required",
            }),
        };
    }

    const includeDeleted =
        event.queryStringParameters?.include_deleted === "true";

    try {
        const items = await listRewardMilestonesByTeacher(teacher_id, { includeDeleted });
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items }),
        };
    } catch (err: any) {
        console.error("Error listing rewards by teacher:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

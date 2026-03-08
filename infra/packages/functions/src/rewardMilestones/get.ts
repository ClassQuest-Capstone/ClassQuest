import { getRewardMilestoneById } from "./repo.ts";

/**
 * GET /teacher/rewards/{reward_id}
 * Fetch a single reward milestone by primary key.
 */
export const handler = async (event: any) => {
    // TODO: verify teacher authorization — confirm the caller owns or manages this reward

    const reward_id = event.pathParameters?.reward_id;
    if (!reward_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_REWARD_ID" }),
        };
    }

    try {
        const item = await getRewardMilestoneById(reward_id);
        if (!item) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "REWARD_NOT_FOUND" }),
            };
        }
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(item),
        };
    } catch (err: any) {
        console.error("Error getting reward milestone:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

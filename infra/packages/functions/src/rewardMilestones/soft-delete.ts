import { getRewardMilestoneById, softDeleteRewardMilestone } from "./repo.ts";

/**
 * DELETE /teacher/rewards/{reward_id}
 * Soft-delete a reward milestone.
 * Sets is_deleted=true and records deleted_at. The item is NOT removed from DynamoDB.
 */
export const handler = async (event: any) => {
    // TODO: verify teacher authorization — confirm the caller owns this reward

    const reward_id = event.pathParameters?.reward_id;
    if (!reward_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_REWARD_ID" }),
        };
    }

    // Verify the item exists before deleting
    let current;
    try {
        current = await getRewardMilestoneById(reward_id);
    } catch (err: any) {
        console.error("Error fetching reward for soft-delete:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }

    if (!current) {
        return {
            statusCode: 404,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "REWARD_NOT_FOUND" }),
        };
    }

    try {
        await softDeleteRewardMilestone(reward_id);
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                reward_id,
                message: "Reward milestone soft-deleted successfully",
            }),
        };
    } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "REWARD_NOT_FOUND" }),
            };
        }
        console.error("Error soft-deleting reward milestone:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

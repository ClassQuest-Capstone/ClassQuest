import { getRewardMilestoneById, restoreRewardMilestone } from "./repo.ts";

/**
 * PATCH /teacher/rewards/{reward_id}/restore
 * Restore a soft-deleted reward milestone.
 * Clears is_deleted and removes deleted_at.
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

    // Verify the item exists (includeDeleted so we can restore it)
    let current;
    try {
        current = await getRewardMilestoneById(reward_id);
    } catch (err: any) {
        console.error("Error fetching reward for restore:", err);
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
        await restoreRewardMilestone(reward_id);
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                reward_id,
                message: "Reward milestone restored successfully",
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
        console.error("Error restoring reward milestone:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

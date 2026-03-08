import { getRewardMilestoneById, setRewardMilestoneStatus } from "./repo.ts";

/**
 * PATCH /teacher/rewards/{reward_id}/status
 * Activate or deactivate a reward milestone.
 * Sort keys are recomputed to reflect the new active/inactive prefix.
 *
 * Body: { "is_active": true | false }
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

    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : (rawBody ?? {});

    if (typeof body.is_active !== "boolean") {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "VALIDATION_FAILED",
                message: "is_active must be a boolean",
            }),
        };
    }

    // Fetch current item for sort key recomputation
    let current;
    try {
        current = await getRewardMilestoneById(reward_id);
    } catch (err: any) {
        console.error("Error fetching reward for status update:", err);
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
        await setRewardMilestoneStatus(reward_id, body.is_active, {
            class_id:     current.class_id,
            unlock_level: current.unlock_level,
            type:         current.type,
        });

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                reward_id,
                is_active: body.is_active,
                message: `Reward ${body.is_active ? "activated" : "deactivated"} successfully`,
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
        console.error("Error setting reward status:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

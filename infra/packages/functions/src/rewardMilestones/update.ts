import { getRewardMilestoneById, updateRewardMilestone } from "./repo.ts";
import { validateUpdateInput } from "./validation.ts";

/**
 * PUT /teacher/rewards/{reward_id}
 * Update editable fields on a reward milestone.
 * If unlock_level or type changes, sort keys are recomputed automatically.
 *
 * Editable fields: title, description, unlock_level, type,
 *                  reward_target_type, reward_target_id, image_asset_key, notes
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

    const errors = validateUpdateInput(body);
    if (errors.length > 0) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "VALIDATION_FAILED", details: errors }),
        };
    }

    // Fetch the current item so we can recompute sort keys if needed
    let current;
    try {
        current = await getRewardMilestoneById(reward_id);
    } catch (err: any) {
        console.error("Error fetching reward for update:", err);
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
        await updateRewardMilestone(reward_id, {
            title:              body.title,
            description:        body.description,
            unlock_level:       body.unlock_level !== undefined ? Number(body.unlock_level) : undefined,
            type:               body.type,
            reward_target_type: body.reward_target_type,
            reward_target_id:   body.reward_target_id,
            image_asset_key:    body.image_asset_key,
            notes:              body.notes,
            updated_by_teacher_id: body.updated_by_teacher_id,
            // Current values needed for sort key recomputation
            current_class_id:     current.class_id,
            current_is_active:    current.is_active,
            current_unlock_level: current.unlock_level,
            current_type:         current.type,
        });

        // Return the updated item
        const updated = await getRewardMilestoneById(reward_id);
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(updated),
        };
    } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "REWARD_NOT_FOUND" }),
            };
        }
        console.error("Error updating reward milestone:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

import { randomUUID } from "crypto";
import { createRewardMilestone } from "./repo.ts";
import { validateCreateInput } from "./validation.ts";
import { buildUnlockSort, buildTeacherSort } from "./keys.ts";
import type { RewardMilestoneItem } from "./types.ts";

/**
 * POST /teacher/rewards
 * Create a new reward milestone for a class.
 *
 * Body: { class_id, created_by_teacher_id, title, description, unlock_level,
 *         type, reward_target_type, reward_target_id, image_asset_path?, is_active?, notes? }
 */
export const handler = async (event: any) => {
    // TODO: verify teacher authorization — confirm the caller is the teacher for this class

    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : (rawBody ?? {});

    const errors = validateCreateInput(body);
    if (errors.length > 0) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "VALIDATION_FAILED", details: errors }),
        };
    }

    // created_by_teacher_id comes from the body until auth is implemented
    const { created_by_teacher_id } = body;
    if (!created_by_teacher_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_FIELD",
                message: "created_by_teacher_id is required",
            }),
        };
    }

    const reward_id = randomUUID();
    const now = new Date().toISOString();
    const is_active = body.is_active !== undefined ? Boolean(body.is_active) : true;

    const item: RewardMilestoneItem = {
        reward_id,
        class_id:              body.class_id,
        created_by_teacher_id,
        title:                 body.title,
        description:           body.description,
        unlock_level:          Number(body.unlock_level),
        type:                  body.type,
        reward_target_type:    body.reward_target_type,
        reward_target_id:      body.reward_target_id,
        image_asset_path:      body.image_asset_path ?? "",
        is_active,
        is_deleted:            false,
        notes:                 body.notes,
        unlock_sort:  buildUnlockSort(is_active, Number(body.unlock_level), body.type, reward_id),
        teacher_sort: buildTeacherSort(body.class_id, is_active, Number(body.unlock_level), reward_id),
        created_at: now,
        updated_at: now,
    };

    try {
        await createRewardMilestone(item);
        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(item),
        };
    } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "REWARD_ALREADY_EXISTS" }),
            };
        }
        console.error("Error creating reward milestone:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

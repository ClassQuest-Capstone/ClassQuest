import { randomUUID } from "crypto";
import { createRewardMilestone } from "./repo.ts";
import { validateCreateInput } from "./validation.ts";
import { buildUnlockSort, buildTeacherSort } from "./keys.ts";
import type { RewardMilestoneItem } from "./types.ts";
import { listStudentsByClass } from "../classEnrollments/repo.js";
import { getPlayerState } from "../playerStates/repo.js";
import { getLevelFromXP } from "../shared/xp-progression.js";
import { createStudentRewardClaim, getStudentRewardClaimByRewardAndStudent } from "../studentRewardClaims/repo.js";
import { buildClaimSort } from "../studentRewardClaims/keys.js";
import type { StudentRewardClaimItem } from "../studentRewardClaims/types.js";

/**
 * POST /teacher/rewards
 * Create a new reward milestone for a class.
 *
 * Body: { class_id, created_by_teacher_id, title, description, unlock_level,
 *         type, reward_target_type, reward_target_id, image_asset_key?, is_active?, notes? }
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
        ...(body.image_asset_key ? { image_asset_key: body.image_asset_key } : {}),
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

    // Best-effort: create AVAILABLE claim rows for all enrolled students already
    // at or above this milestone's unlock_level.
    try {
        const enrollments = await listStudentsByClass(item.class_id, "active");
        const now = new Date().toISOString();

        for (const enrollment of enrollments) {
            const playerState = await getPlayerState(item.class_id, enrollment.student_id);
            const studentLevel = playerState ? getLevelFromXP(playerState.total_xp_earned) : 1;

            if (studentLevel < item.unlock_level) continue;

            const existing = await getStudentRewardClaimByRewardAndStudent(
                item.reward_id,
                enrollment.student_id
            );
            if (existing) continue;

            const claimItem: StudentRewardClaimItem = {
                student_reward_claim_id: randomUUID(),
                student_id:         enrollment.student_id,
                class_id:           item.class_id,
                reward_id:          item.reward_id,
                status:             "AVAILABLE",
                unlocked_at_level:  item.unlock_level,
                claim_sort:         buildClaimSort("AVAILABLE", item.class_id, item.unlock_level, item.reward_id),
                unlocked_at:        now,
                reward_target_type: item.reward_target_type,
                reward_target_id:   item.reward_target_id,
                created_at:         now,
                updated_at:         now,
            };

            await createStudentRewardClaim(claimItem);
        }
    } catch (seedErr) {
        // Non-fatal: reward was created; log and continue
        console.error("Non-fatal: failed to seed reward claims for existing students:", seedErr);
    }

    return {
        statusCode: 201,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item),
    };
};

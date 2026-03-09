import { randomUUID } from "crypto";
import { createStudentRewardClaim, getStudentRewardClaimByRewardAndStudent } from "./repo.ts";
import { validateCreateInput } from "./validation.ts";
import { buildClaimSort } from "./keys.ts";
import type { StudentRewardClaimItem } from "./types.ts";

/**
 * POST /internal/student-reward-claims
 * Create a student reward claim row manually or from internal level-up logic.
 *
 * TODO: verify internal routes are admin-only
 *
 * Body: { student_id, class_id, reward_id, status, unlocked_at_level,
 *         reward_target_type, reward_target_id, unlocked_at?, claimed_at?, notes? }
 */
export const handler = async (event: any) => {
    // TODO: verify internal routes are admin-only

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

    // Prevent duplicate claim for same student_id + reward_id
    const existing = await getStudentRewardClaimByRewardAndStudent(body.reward_id, body.student_id);
    if (existing) {
        return {
            statusCode: 409,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "CLAIM_ALREADY_EXISTS",
                message: "A claim row already exists for this student and reward",
                existing_claim_id: existing.student_reward_claim_id,
            }),
        };
    }

    const student_reward_claim_id = randomUUID();
    const now = new Date().toISOString();
    const status = body.status;
    const unlocked_at_level = Number(body.unlocked_at_level);

    const item: StudentRewardClaimItem = {
        student_reward_claim_id,
        student_id:        body.student_id,
        class_id:          body.class_id,
        reward_id:         body.reward_id,
        status,
        unlocked_at_level,
        claim_sort: buildClaimSort(status, body.class_id, unlocked_at_level, body.reward_id),
        unlocked_at: status === "AVAILABLE" ? (body.unlocked_at ?? now) : body.unlocked_at,
        claimed_at:  status === "CLAIMED"   ? (body.claimed_at ?? now)  : body.claimed_at,
        reward_target_type: body.reward_target_type,
        reward_target_id:   body.reward_target_id,
        notes:      body.notes,
        created_at: now,
        updated_at: now,
    };

    try {
        await createStudentRewardClaim(item);
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
                body: JSON.stringify({ error: "CLAIM_ALREADY_EXISTS" }),
            };
        }
        console.error("Error creating student reward claim:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

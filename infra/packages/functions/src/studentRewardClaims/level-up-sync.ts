import { randomUUID } from "crypto";
import { listRewardMilestonesByClass } from "../rewardMilestones/repo.js";
import { getStudentRewardClaimByRewardAndStudent, createStudentRewardClaim } from "./repo.ts";
import { buildClaimSort } from "./keys.ts";
import type { StudentRewardClaimItem } from "./types.ts";

/**
 * POST /internal/students/{student_id}/reward-claims/level-up-sync
 * Create AVAILABLE claim rows for all reward milestones newly crossed
 * when a student's level increases from old_level to new_level.
 *
 * Idempotent: skips milestones that already have a claim row for this student.
 *
 * TODO: verify internal routes are admin-only
 *
 * Body: { class_id, old_level, new_level }
 */
export const handler = async (event: any) => {
    // TODO: verify internal routes are admin-only

    const student_id = event.pathParameters?.student_id;
    if (!student_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_STUDENT_ID" }),
        };
    }

    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : (rawBody ?? {});

    const { class_id } = body;
    const old_level = Number(body.old_level);
    const new_level = Number(body.new_level);

    if (!class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_FIELD", message: "class_id is required" }),
        };
    }
    if (!Number.isInteger(old_level) || old_level < 0) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_FIELD",
                message: "old_level must be an integer >= 0",
            }),
        };
    }
    if (!Number.isInteger(new_level) || new_level < 1) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_FIELD",
                message: "new_level must be an integer >= 1",
            }),
        };
    }

    // No-op: level did not increase
    if (new_level <= old_level) {
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                student_id,
                class_id,
                old_level,
                new_level,
                created_count: 0,
                created_claims: [],
                message: "No level increase — no claims created",
            }),
        };
    }

    try {
        // Fetch all active, non-deleted milestones for the class
        const allMilestones = await listRewardMilestonesByClass(class_id, { includeDeleted: false });
        const crossed = allMilestones.filter(
            m =>
                m.is_active &&
                !m.is_deleted &&
                m.unlock_level > old_level &&
                m.unlock_level <= new_level
        );

        const created: StudentRewardClaimItem[] = [];
        const now = new Date().toISOString();

        for (const milestone of crossed) {
            // Idempotency: skip if claim row already exists for this student + reward
            const existing = await getStudentRewardClaimByRewardAndStudent(
                milestone.reward_id,
                student_id
            );
            if (existing) continue;

            const item: StudentRewardClaimItem = {
                student_reward_claim_id: randomUUID(),
                student_id,
                class_id,
                reward_id:         milestone.reward_id,
                status:            "AVAILABLE",
                unlocked_at_level: milestone.unlock_level,
                claim_sort: buildClaimSort(
                    "AVAILABLE",
                    class_id,
                    milestone.unlock_level,
                    milestone.reward_id
                ),
                unlocked_at:        now,
                reward_target_type: milestone.reward_target_type,
                reward_target_id:   milestone.reward_target_id,
                created_at: now,
                updated_at: now,
            };

            await createStudentRewardClaim(item);
            created.push(item);
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                student_id,
                class_id,
                old_level,
                new_level,
                created_count: created.length,
                created_claims: created,
            }),
        };
    } catch (err: any) {
        console.error("Error in level-up-sync:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

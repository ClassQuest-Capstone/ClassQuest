import { randomUUID } from "crypto";
import type { EnrollmentItem } from "./types.ts";
import { putEnrollment, findEnrollmentByClassAndStudent } from "./repo.ts";
import { listRewardMilestonesByClass } from "../rewardMilestones/repo.js";
import { getPlayerState } from "../playerStates/repo.js";
import { getLevelFromXP } from "../shared/xp-progression.js";
import { createStudentRewardClaim, getStudentRewardClaimByRewardAndStudent } from "../studentRewardClaims/repo.js";
import { buildClaimSort } from "../studentRewardClaims/keys.js";
import type { StudentRewardClaimItem } from "../studentRewardClaims/types.js";

/**
 * POST /classes/{class_id}/enroll
 * Student joins a class
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify student is authenticated and matches student_id in body

    // Step 1: Extract class_id from path parameters
    const class_id = event.pathParameters?.class_id;

    if (!class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_CLASS_ID" }),
        };
    }

    // Step 2: Parse request body
    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : rawBody ?? {};

    const { student_id } = body;

    if (!student_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_STUDENT_ID",
                message: "Required field: student_id",
            }),
        };
    }

    if (typeof student_id !== "string" || student_id.trim() === "") {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_STUDENT_ID",
                message: "student_id must be a non-empty string",
            }),
        };
    }

    // TODO AUTH: Verify student_id matches authenticated user
    // TODO: Verify class exists and is active (optional)

    // TODO (EquippedItems): After successful enrollment (Step 4), auto-create an EquippedItems
    // record for this student + class. Requires the student's avatar_base_id (read from
    // PlayerAvatars by class+student, or from StudentProfiles). Call createEquippedItems()
    // from the equippedItems domain. Treat as best-effort — log failures but do not roll back
    // the enrollment if EquippedItems creation fails.

    // Step 3: Check for existing enrollment (prevent duplicates)
    const existing = await findEnrollmentByClassAndStudent(
        class_id,
        student_id
    );

    if (existing) {
        if (existing.status === "active") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "ALREADY_ENROLLED",
                    message: "Student is already enrolled in this class",
                    enrollment_id: existing.enrollment_id,
                }),
            };
        } else if (existing.status === "dropped") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "ENROLLMENT_DROPPED",
                    message: "Student was previously removed from this class. A teacher must restore them using POST /classes/{class_id}/students/{student_id}/restore",
                    enrollment_id: existing.enrollment_id,
                }),
            };
        }
    }

    // Step 4: Create new enrollment
    const enrollment_id = randomUUID();
    const now = new Date().toISOString();

    const item: EnrollmentItem = {
        enrollment_id,
        class_id: class_id.trim(),
        student_id: student_id.trim(),
        joined_at: now,
        status: "active",
    };

    try {
        await putEnrollment(item);
    } catch (error: any) {
        console.error("Error creating enrollment:", error);
        throw error;
    }

    // Best-effort: seed AVAILABLE claim rows for any reward milestones the student
    // already qualifies for at their current level (new students default to level 1).
    try {
        const milestones = await listRewardMilestonesByClass(class_id, { includeDeleted: false });
        const qualifying = milestones.filter(m => m.is_active && !m.is_deleted);

        if (qualifying.length > 0) {
            const playerState = await getPlayerState(class_id, student_id);
            const studentLevel = playerState ? getLevelFromXP(playerState.total_xp_earned) : 1;
            const now = new Date().toISOString();

            for (const milestone of qualifying) {
                if (milestone.unlock_level > studentLevel) continue;

                const existing = await getStudentRewardClaimByRewardAndStudent(
                    milestone.reward_id,
                    student_id
                );
                if (existing) continue;

                const claimItem: StudentRewardClaimItem = {
                    student_reward_claim_id: randomUUID(),
                    student_id,
                    class_id,
                    reward_id:          milestone.reward_id,
                    status:             "AVAILABLE",
                    unlocked_at_level:  milestone.unlock_level,
                    claim_sort:         buildClaimSort("AVAILABLE", class_id, milestone.unlock_level, milestone.reward_id),
                    unlocked_at:        now,
                    reward_target_type: milestone.reward_target_type,
                    reward_target_id:   milestone.reward_target_id,
                    created_at:         now,
                    updated_at:         now,
                };

                await createStudentRewardClaim(claimItem);
            }
        }
    } catch (rewardErr) {
        // Non-fatal: enrollment succeeded; log and continue
        console.error("Non-fatal: failed to seed reward claims on enrollment:", rewardErr);
    }

    return {
        statusCode: 201,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            enrollment_id,
            message: "Successfully enrolled in class",
        }),
    };
};

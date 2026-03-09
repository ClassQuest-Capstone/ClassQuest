import { getStudentRewardClaimByRewardAndStudent, updateStudentRewardClaimStatus } from "./repo.ts";
import { buildClaimSort } from "./keys.ts";

/**
 * POST /student/rewards/{reward_id}/claim
 * Allow a student to claim an AVAILABLE reward.
 * Only AVAILABLE → CLAIMED transition is permitted.
 *
 * TODO: verify authenticated student matches student_id
 * TODO: verify student belongs to class_id
 *
 * Body: { student_id, class_id }
 */
export const handler = async (event: any) => {
    // TODO: verify authenticated student matches student_id

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

    const { student_id, class_id } = body;
    if (!student_id || !class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_FIELDS",
                message: "student_id and class_id are required in the request body",
            }),
        };
    }

    try {
        // Look up the claim row for this student + reward
        const claim = await getStudentRewardClaimByRewardAndStudent(reward_id, student_id);
        if (!claim) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "CLAIM_NOT_FOUND",
                    message: "No reward claim found for this student and reward. " +
                        "The student may not have reached the required level yet.",
                }),
            };
        }

        if (claim.status === "CLAIMED") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "ALREADY_CLAIMED",
                    message: "This reward has already been claimed",
                    claimed_at: claim.claimed_at,
                }),
            };
        }

        const now = new Date().toISOString();
        const newClaimSort = buildClaimSort(
            "CLAIMED",
            claim.class_id,
            claim.unlocked_at_level,
            reward_id
        );

        await updateStudentRewardClaimStatus(
            claim.student_reward_claim_id,
            "CLAIMED",
            newClaimSort,
            now,
        );

        // TODO: grant actual inventory item, badge, or avatar reward here.
        //       Use claim.reward_target_type and claim.reward_target_id to determine what to grant.
        //       This will write to an InventoryItems table or similar once that feature is implemented.

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                message: "Reward claimed successfully",
                reward_id,
                student_id,
                status: "CLAIMED",
                claimed_at: now,
            }),
        };
    } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
            // Race condition: reward was claimed between our check and update
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "ALREADY_CLAIMED" }),
            };
        }
        console.error("Error claiming student reward:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

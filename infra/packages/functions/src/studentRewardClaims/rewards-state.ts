import { listRewardMilestonesByClass } from "../rewardMilestones/repo.js";
import { listStudentRewardClaimsByStudentAndClass } from "./repo.ts";
import { getPlayerState } from "../playerStates/repo.js";
import { getLevelFromXP } from "../shared/xp-progression.js";

/**
 * GET /student/classes/{class_id}/rewards-state
 * Return merged reward state (LOCKED / AVAILABLE / CLAIMED) for the UI.
 *
 * Combines three data sources:
 *   - RewardMilestones   — teacher-defined milestone definitions
 *   - StudentRewardClaims — per-student claim status rows
 *   - PlayerStates       — current student level
 *
 * TODO: verify authenticated student matches student_id
 * TODO: verify student belongs to class_id
 *
 * State rules:
 *   CLAIMED   — claim row exists with status=CLAIMED
 *   AVAILABLE — claim row exists with status=AVAILABLE
 *   AVAILABLE — no claim row but student_level >= unlock_level (reached but not yet synced)
 *   LOCKED    — no claim row and student_level < unlock_level
 *
 * Query params:
 *   student_id=xxx  — required until auth is implemented
 *
 * TODO: sync level formula with game design doc / frontend level helper.
 */
export const handler = async (event: any) => {
    // TODO: verify student belongs to this class

    const class_id = event.pathParameters?.class_id;
    if (!class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_CLASS_ID" }),
        };
    }

    // TODO: replace with JWT claim once auth is implemented
    const student_id = event.queryStringParameters?.student_id;
    if (!student_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_STUDENT_ID",
                message: "student_id query parameter is required",
            }),
        };
    }

    try {
        // 1. Derive student level from PlayerStates using the same formula as frontend was wrong before
        const playerState = await getPlayerState(class_id, student_id);
        const student_level = playerState
            ? getLevelFromXP(playerState.total_xp_earned)
            : 1;

        // 2. Get all active, non-deleted reward milestones for the class
        const allMilestones = await listRewardMilestonesByClass(class_id, { includeDeleted: false });
        const activeMilestones = allMilestones.filter(m => m.is_active);

        // 3. Get all claim rows for this student in this class
        const claims = await listStudentRewardClaimsByStudentAndClass(student_id, class_id);
        const claimByRewardId = new Map(claims.map(c => [c.reward_id, c]));

        // 4. Merge into UI state
        const rewards = activeMilestones.map(milestone => {
            const claim = claimByRewardId.get(milestone.reward_id);

            let state: "LOCKED" | "AVAILABLE" | "CLAIMED";
            if (claim?.status === "CLAIMED") {
                state = "CLAIMED";
            } else if (claim?.status === "AVAILABLE") {
                state = "AVAILABLE";
            } else if (student_level >= milestone.unlock_level) {
                // Student has the level but no claim row exists yet
                // (level-up sync hasn't run or reward was added after levelling up)
                state = "AVAILABLE";
            } else {
                state = "LOCKED";
            }

            return {
                reward_id:        milestone.reward_id,
                title:            milestone.title,
                description:      milestone.description,
                unlock_level:     milestone.unlock_level,
                type:             milestone.type,
                image_asset_key: milestone.image_asset_key,
                state,
                claimed_at:  claim?.claimed_at  ?? null,
                unlocked_at: claim?.unlocked_at ?? null,
            };
        });

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                class_id,
                student_id,
                student_level,
                rewards,
            }),
        };
    } catch (err: any) {
        console.error("Error getting student rewards state:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

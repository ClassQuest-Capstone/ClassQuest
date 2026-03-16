import { listRewardMilestonesByClass } from "./repo.ts";
import { getPlayerState } from "../playerStates/repo.js";
import { getLevelFromXP } from "../shared/xp-progression.js";

/**
 * GET /student/classes/{class_id}/rewards
 *
 * Returns active, non-deleted rewards for a class with lock/unlock status
 * computed against the requesting student's current level.
 *
 * Query params:
 *   student_id=xxx  — required until auth is implemented
 *
 * TODO: once auth is implemented, student_id will come from the JWT token;
 *       also verify the student is enrolled in this class.
 *
 * Level derivation:
 *   Student level is derived from PlayerStates.total_xp_earned using a simple
 *   linear formula: level = floor(total_xp_earned / 100) + 1.
 *   A new student (0 XP) starts at level 1.
 *   TODO: sync this formula with the game design document / frontend level helper.
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
        // Fetch all active, non-deleted rewards for the class
        const allRewards = await listRewardMilestonesByClass(class_id, { includeDeleted: false });
        const activeRewards = allRewards.filter(r => r.is_active);

        // Derive student level from PlayerStates
        // TODO: sync level formula with game design doc / frontend
        const playerState = await getPlayerState(class_id, student_id);
        const studentLevel = playerState
            ? getLevelFromXP(playerState.total_xp_earned)
            : 1;  // default to level 1 for students with no recorded state

        const items = activeRewards.map(reward => ({
            reward_id:       reward.reward_id,
            title:           reward.title,
            description:     reward.description,
            unlock_level:    reward.unlock_level,
            type:            reward.type,
            image_asset_key: reward.image_asset_key,
            locked:          studentLevel < reward.unlock_level,
            unlocked:        studentLevel >= reward.unlock_level,
            reached_level:   studentLevel,
        }));

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items, student_level: studentLevel }),
        };
    } catch (err: any) {
        console.error("Error listing student rewards:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

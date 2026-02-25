/**
 * POST /bossBattleInstances/{boss_instance_id}/participants/leave
 * Leave a boss battle
 */

import { setParticipantLeft } from "./repo.js";

export const handler = async (event: any) => {
    try {
        const bossInstanceId = event.pathParameters?.boss_instance_id;
        if (!bossInstanceId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "boss_instance_id is required" }),
            };
        }

        // Extract student_id from JWT claims
        const studentId = event.requestContext?.authorizer?.jwt?.claims?.sub;
        if (!studentId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized" }),
            };
        }

        // Set to LEFT
        await setParticipantLeft(bossInstanceId, studentId);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Successfully left the battle",
            }),
        };
    } catch (error: any) {
        console.error("Error leaving battle:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

/**
 * POST /bossBattleInstances/{boss_instance_id}/participants/spectate
 * Manually set participant to spectate mode
 */

import { setParticipantSpectate } from "./repo.js";

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

        // Set to spectate
        await setParticipantSpectate(bossInstanceId, studentId);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Successfully set to spectate mode",
            }),
        };
    } catch (error: any) {
        console.error("Error setting spectate:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

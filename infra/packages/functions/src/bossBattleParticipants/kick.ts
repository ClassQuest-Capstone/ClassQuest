/**
 * POST /bossBattleInstances/{boss_instance_id}/participants/{student_id}/kick
 * Kick a participant from a battle (teacher only)
 */

import { kickParticipant } from "./repo.js";

export const handler = async (event: any) => {
    try {
        const bossInstanceId = event.pathParameters?.boss_instance_id;
        const studentId = event.pathParameters?.student_id;

        if (!bossInstanceId || !studentId) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: "boss_instance_id and student_id are required",
                }),
            };
        }

        // Parse body for optional kick reason
        const body = JSON.parse(event.body || "{}");
        const { reason } = body;

        // Kick participant
        await kickParticipant(bossInstanceId, studentId, reason);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Successfully kicked student ${studentId} from battle`,
            }),
        };
    } catch (error: any) {
        console.error("Error kicking participant:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

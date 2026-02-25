/**
 * POST /bossBattleInstances/{boss_instance_id}/snapshots/participants
 * Create participants snapshot (used when starting countdown)
 */

import { createParticipantsSnapshot } from "./repo.js";

export const handler = async (event: any) => {
    try {
        const bossInstanceId = event.pathParameters?.boss_instance_id;
        if (!bossInstanceId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "boss_instance_id is required" }),
            };
        }

        // TODO: Authorization - TEACHER only
        // Extract teacher_id from JWT claims
        const teacherId = event.requestContext?.authorizer?.jwt?.claims?.sub || "system";

        // Create snapshot
        const snapshot = await createParticipantsSnapshot({
            boss_instance_id: bossInstanceId,
            created_by_teacher_id: teacherId,
        });

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: "Participants snapshot created successfully",
                snapshot_id: snapshot.snapshot_id,
                joined_count: snapshot.joined_count,
                guild_counts: snapshot.guild_counts,
            }),
        };
    } catch (error: any) {
        console.error("Error creating participants snapshot:", error);
        return {
            statusCode: error.message.includes("already exists") ? 400 : 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

/**
 * GET /bossBattleInstances/{boss_instance_id}/participants
 * List all participants in a battle
 */

import { listParticipants } from "./repo.js";
import { ParticipantState } from "./types.js";

export const handler = async (event: any) => {
    try {
        const bossInstanceId = event.pathParameters?.boss_instance_id;
        if (!bossInstanceId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "boss_instance_id is required" }),
            };
        }

        // Optional state filter from query parameters
        const stateFilter = event.queryStringParameters?.state as
            | ParticipantState
            | undefined;

        // List participants
        const participants = await listParticipants(bossInstanceId, {
            state: stateFilter,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                items: participants,
                count: participants.length,
            }),
        };
    } catch (error: any) {
        console.error("Error listing participants:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

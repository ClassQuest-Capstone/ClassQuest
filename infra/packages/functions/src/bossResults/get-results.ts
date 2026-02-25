/**
 * GET /bossBattleInstances/{boss_instance_id}/results
 * Get aggregated results for a battle
 */

import { getBossResults } from "./repo.js";

export const handler = async (event: any) => {
    try {
        const bossInstanceId = event.pathParameters?.boss_instance_id;
        if (!bossInstanceId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "boss_instance_id is required" }),
            };
        }

        // TODO: Authorization
        // - TEACHER: full results
        // - STUDENT: only their own row + guild row

        const results = await getBossResults(bossInstanceId);

        return {
            statusCode: 200,
            body: JSON.stringify(results),
        };
    } catch (error: any) {
        console.error("Error getting boss results:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

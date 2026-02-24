/**
 * POST /bossBattleInstances/{boss_instance_id}/results/compute
 * Manually trigger results computation
 * (Can also be triggered automatically when battle completes)
 */

import { computeAndWriteBossResults } from "./repo.js";

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

        const result = await computeAndWriteBossResults(
            bossInstanceId,
            "manual-trigger"
        );

        return {
            statusCode: result.success ? 200 : 400,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error computing boss results:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

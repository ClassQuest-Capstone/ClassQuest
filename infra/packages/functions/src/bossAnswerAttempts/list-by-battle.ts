/**
 * GET /bossBattleInstances/{boss_instance_id}/attempts
 * List all attempts in a battle (teacher only)
 */

import { listAttemptsByBattle } from "./repo.js";

export const handler = async (event: any) => {
    try {
        const bossInstanceId = event.pathParameters?.boss_instance_id;
        if (!bossInstanceId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "boss_instance_id is required" }),
            };
        }

        // Parse query parameters
        const limit = event.queryStringParameters?.limit
            ? parseInt(event.queryStringParameters.limit, 10)
            : undefined;
        const nextToken = event.queryStringParameters?.cursor;

        // List attempts
        const result = await listAttemptsByBattle(bossInstanceId, {
            limit,
            nextToken,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                items: result.items,
                nextToken: result.nextToken,
                count: result.items.length,
            }),
        };
    } catch (error: any) {
        console.error("Error listing attempts by battle:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

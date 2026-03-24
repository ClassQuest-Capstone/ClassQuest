import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getAvatar } from "./repo.ts";

/**
 * GET /player-avatars/{player_avatar_id}
 *
 * Returns a single PlayerAvatar record by id.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const player_avatar_id = event.pathParameters?.player_avatar_id;

        if (!player_avatar_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing player_avatar_id in path" }),
            };
        }

        const avatar = await getAvatar(player_avatar_id);

        if (!avatar) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Player avatar not found" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(avatar),
        };
    } catch (error: any) {
        console.error("Error getting player avatar:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

import { getGuild } from "./repo.js";

export const handler = async (event: any) => {
    try {
        const guild_id = event.pathParameters?.guild_id;

        if (!guild_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required path parameter: guild_id",
                }),
            };
        }

        const guild = await getGuild(guild_id);

        if (!guild) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Guild not found",
                }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(guild),
        };
    } catch (err: any) {
        console.error("Error getting guild:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "Internal server error",
                message: err.message,
            }),
        };
    }
};

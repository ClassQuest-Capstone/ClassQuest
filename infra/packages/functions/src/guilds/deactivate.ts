import { deactivateGuild } from "./repo.js";

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

        const updated = await deactivateGuild(guild_id);

        if (!updated) {
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
            body: JSON.stringify(updated),
        };
    } catch (err: any) {
        console.error("Error deactivating guild:", err);

        // Handle condition check failure (guild not found)
        if (err.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Guild not found",
                }),
            };
        }

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

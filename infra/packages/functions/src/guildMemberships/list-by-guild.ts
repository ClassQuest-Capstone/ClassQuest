import { listMembersByGuild } from "./repo.js";

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

        // Parse query parameters
        const limitParam = event.queryStringParameters?.limit;
        const cursor = event.queryStringParameters?.cursor;

        let limit = 50; // default
        if (limitParam) {
            const parsed = parseInt(limitParam, 10);
            if (isNaN(parsed) || parsed < 1) {
                return {
                    statusCode: 400,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        error: "Invalid limit parameter: must be a positive integer",
                    }),
                };
            }
            limit = parsed;
        }

        // Get members with pagination
        const result = await listMembersByGuild(guild_id, limit, cursor);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                items: result.items,
                nextCursor: result.nextCursor,
                hasMore: !!result.nextCursor,
            }),
        };
    } catch (err: any) {
        console.error("Error listing guild members:", err);

        // Handle invalid cursor error specifically
        if (err.message === "Invalid cursor format") {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Invalid cursor format",
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

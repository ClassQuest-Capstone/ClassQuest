import { listByInstance } from "./repo.js";
import { normalizeResponseItem } from "./types.js";

export const handler = async (event: any) => {
    const quest_instance_id = event.pathParameters?.quest_instance_id;

    if (!quest_instance_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "Missing required path parameter: quest_instance_id"
            }),
        };
    }

    const limit = event.queryStringParameters?.limit
        ? parseInt(event.queryStringParameters.limit, 10)
        : undefined;
    const cursor = event.queryStringParameters?.cursor;

    try {
        const result = await listByInstance(quest_instance_id, limit, cursor);

        // Normalize all responses with defaults for backward compatibility
        const normalizedItems = result.items.map(item => normalizeResponseItem(item));

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ok: true,
                responses: normalizedItems,
                count: normalizedItems.length,
                cursor: result.cursor,
            }),
        };
    } catch (error: any) {
        console.error("Error fetching responses:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "Internal server error" }),
        };
    }
};

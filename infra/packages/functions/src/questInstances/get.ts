import { getInstance } from "./repo.ts";

/**
 * GET /quest-instances/{quest_instance_id}
 * Get a quest instance by ID
 */
export const handler = async (event: any) => {
    const quest_instance_id = event.pathParameters?.quest_instance_id;

    if (!quest_instance_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_QUEST_INSTANCE_ID" }),
        };
    }

    try {
        const item = await getInstance(quest_instance_id);

        if (!item) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "QUEST_INSTANCE_NOT_FOUND" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(item),
        };
    } catch (error) {
        console.error("Error fetching quest instance:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

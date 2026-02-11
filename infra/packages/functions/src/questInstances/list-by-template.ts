import { listByTemplate } from "./repo.ts";

/**
 * GET /quest-templates/{quest_template_id}/quest-instances
 * List all instances created from a template
 */
export const handler = async (event: any) => {
    const quest_template_id = event.pathParameters?.quest_template_id;

    if (!quest_template_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_QUEST_TEMPLATE_ID" }),
        };
    }

    try {
        const items = await listByTemplate(quest_template_id);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items, count: items.length }),
        };
    } catch (error) {
        console.error("Error listing quest instances by template:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

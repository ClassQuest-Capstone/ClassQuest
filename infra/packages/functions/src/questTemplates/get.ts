import { getTemplate } from "./repo.ts";

/**
 * GET /quest-templates/{quest_template_id}
 * Get a single quest template by ID
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify user has access (owner or public template)

    const quest_template_id = event.pathParameters?.quest_template_id;

    if (!quest_template_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_QUEST_TEMPLATE_ID" }),
        };
    }

    const item = await getTemplate(quest_template_id);

    return {
        statusCode: item ? 200 : 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item ?? { error: "QUEST_TEMPLATE_NOT_FOUND" }),
    };
};

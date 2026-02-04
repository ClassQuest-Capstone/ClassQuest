import { listByTemplate } from "./repo.ts";

/**
 * GET /quest-templates/{template_id}/questions
 * List all questions for a quest template, ordered by order_key
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify user has access to this template

    const template_id = event.pathParameters?.template_id;

    if (!template_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_TEMPLATE_ID" }),
        };
    }

    const items = await listByTemplate(template_id);

    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
    };
};

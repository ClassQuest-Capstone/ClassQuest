import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getTemplate } from "./repo.ts";

/**
 * GET /boss-battle-templates/{boss_template_id}
 * Get a boss battle template by ID
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const boss_template_id = event.pathParameters?.boss_template_id;

        if (!boss_template_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing boss_template_id in path" }),
            };
        }

        const template = await getTemplate(boss_template_id);

        if (!template) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Template not found" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(template),
        };
    } catch (error: any) {
        console.error("Error getting boss battle template:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: error.message || "Internal server error",
            }),
        };
    }
};

import { restoreTemplate } from "./repo.ts";

const corsHeaders = {
    "content-type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
};

/**
 * PATCH /boss-battle-templates/{boss_template_id}/restore
 * Restore a soft-deleted boss battle template (sets is_deleted=false)
 */
export const handler = async (event: any) => {
    const boss_template_id = event.pathParameters?.boss_template_id;

    if (!boss_template_id) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
                error: "Missing required path parameter: boss_template_id",
            }),
        };
    }

    try {
        const restoredTemplate = await restoreTemplate(boss_template_id);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                ok: true,
                message: "Boss battle template restored successfully",
                template: restoredTemplate,
            }),
        };
    } catch (error: any) {
        console.error("Error restoring boss battle template:", error);

        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: "Boss battle template not found",
                }),
            };
        }

        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Internal server error" }),
        };
    }
};

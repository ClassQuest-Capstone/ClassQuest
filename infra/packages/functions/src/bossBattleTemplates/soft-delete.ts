import { softDeleteTemplate } from "./repo.ts";

const corsHeaders = {
    "content-type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
};

/**
 * PATCH /boss-battle-templates/{boss_template_id}/soft-delete
 * Soft-delete a boss battle template (sets is_deleted=true, does NOT remove the item)
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

    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : (rawBody ?? {});

    const deleted_by_teacher_id = body.deleted_by_teacher_id;

    if (
        !deleted_by_teacher_id ||
        typeof deleted_by_teacher_id !== "string" ||
        deleted_by_teacher_id.trim() === ""
    ) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
                error: "Missing or invalid required field: deleted_by_teacher_id must be a non-empty string",
            }),
        };
    }

    try {
        const deletedTemplate = await softDeleteTemplate(
            boss_template_id,
            deleted_by_teacher_id.trim()
        );

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                ok: true,
                message: "Boss battle template soft deleted successfully",
                template: deletedTemplate,
            }),
        };
    } catch (error: any) {
        console.error("Error soft deleting boss battle template:", error);

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

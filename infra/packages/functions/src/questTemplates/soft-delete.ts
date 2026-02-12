import { softDeleteTemplate } from "./repo.js";

export const handler = async (event: any) => {
    const quest_template_id = event.pathParameters?.quest_template_id;

    if (!quest_template_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "Missing required path parameter: quest_template_id"
            }),
        };
    }

    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : (rawBody ?? {});

    const deleted_by_teacher_id = body.deleted_by_teacher_id;

    if (!deleted_by_teacher_id || typeof deleted_by_teacher_id !== "string" || deleted_by_teacher_id.trim() === "") {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "Missing or invalid required field: deleted_by_teacher_id must be a non-empty string"
            }),
        };
    }

    try {
        const deletedTemplate = await softDeleteTemplate(quest_template_id, deleted_by_teacher_id.trim());

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ok: true,
                message: "Quest template soft deleted successfully",
                template: deletedTemplate,
            }),
        };
    } catch (error: any) {
        console.error("Error soft deleting quest template:", error);

        // Check if template doesn't exist
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Quest template not found"
                }),
            };
        }

        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "Internal server error"
            }),
        };
    }
};

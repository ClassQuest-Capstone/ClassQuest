import { updateGuild } from "./repo.js";
import { validateGuildPatch } from "./validation.js";

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

        const rawBody = event?.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : (rawBody ?? {});

        // Validate patch
        const validationErrors = validateGuildPatch(body);
        if (validationErrors.length > 0) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Validation failed",
                    details: validationErrors,
                }),
            };
        }

        // Build patch object
        const patch: { name?: string; is_active?: boolean } = {};
        if (body.name !== undefined) {
            patch.name = body.name.trim();
        }
        if (body.is_active !== undefined) {
            patch.is_active = body.is_active;
        }

        const updated = await updateGuild(guild_id, patch);

        if (!updated) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Guild not found",
                }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(updated),
        };
    } catch (err: any) {
        console.error("Error updating guild:", err);

        // Handle condition check failure (guild not found)
        if (err.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Guild not found",
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

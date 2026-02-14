import { randomUUID } from "crypto";
import { createGuild } from "./repo.js";
import { makeGsi1Sk } from "./keys.js";
import { validateGuildName } from "./validation.js";

export const handler = async (event: any) => {
    try {
        const class_id = event.pathParameters?.class_id;

        if (!class_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required path parameter: class_id",
                }),
            };
        }

        const rawBody = event?.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : (rawBody ?? {});

        // Validate name
        const validationErrors = validateGuildName(body.name);
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

        const guild_id = randomUUID();
        const now = new Date().toISOString();
        const name = body.name.trim();

        await createGuild({
            guild_id,
            class_id,
            name,
            is_active: true,
            gsi1sk: makeGsi1Sk(now, guild_id),
            created_at: now,
            updated_at: now,
        });

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ok: true,
                guild_id,
            }),
        };
    } catch (err: any) {
        console.error("Error creating guild:", err);

        // Handle duplicate guild_id (extremely rare with UUIDs)
        if (err.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Guild already exists",
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

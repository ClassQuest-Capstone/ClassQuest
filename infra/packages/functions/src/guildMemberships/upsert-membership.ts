import { upsertMembership, getMembership, changeGuild } from "./repo.js";
import { makeGsi1Sk, makeGsi2Sk } from "./keys.js";
import { validateUpsertMembership } from "./validation.js";

export const handler = async (event: any) => {
    try {
        const class_id = event.pathParameters?.class_id;
        const student_id = event.pathParameters?.student_id;

        if (!class_id || !student_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required path parameters: class_id, student_id",
                }),
            };
        }

        const rawBody = event?.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : (rawBody ?? {});

        // Validate input
        const validationErrors = validateUpsertMembership(body);
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

        const guild_id = body.guild_id;
        const role_in_guild = body.role_in_guild || "MEMBER";
        const now = new Date().toISOString();

        // Check if membership exists
        const existing = await getMembership(class_id, student_id);

        if (existing && existing.guild_id !== guild_id) {
            // Change guild (different guild)
            const updated = await changeGuild(class_id, student_id, guild_id, role_in_guild);
            return {
                statusCode: 200,
                headers: { "content-type": "application/json" },
                body: JSON.stringify(updated),
            };
        } else if (existing && existing.guild_id === guild_id) {
            // Same guild, update role only if provided
            if (body.role_in_guild !== undefined) {
                // Update role while keeping existing data
                await upsertMembership({
                    ...existing,
                    role_in_guild,
                    updated_at: now,
                });
            }
            const updated = await getMembership(class_id, student_id);
            return {
                statusCode: 200,
                headers: { "content-type": "application/json" },
                body: JSON.stringify(updated),
            };
        } else {
            // New membership
            await upsertMembership({
                class_id,
                student_id,
                guild_id,
                role_in_guild,
                joined_at: now,
                is_active: true,
                updated_at: now,
                gsi1sk: makeGsi1Sk(now, student_id),
                gsi2sk: makeGsi2Sk(now, class_id, guild_id),
            });

            const created = await getMembership(class_id, student_id);
            return {
                statusCode: 201,
                headers: { "content-type": "application/json" },
                body: JSON.stringify(created),
            };
        }
    } catch (err: any) {
        console.error("Error upserting membership:", err);
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

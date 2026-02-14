import { upsertPlayerState } from "./repo.js";
import { validatePlayerState } from "./validation.js";

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
        const validationErrors = validatePlayerState(body);
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

        // Upsert player state
        await upsertPlayerState({
            class_id,
            student_id,
            current_xp: body.current_xp,
            xp_to_next_level: body.xp_to_next_level,
            total_xp_earned: body.total_xp_earned,
            hearts: body.hearts,
            max_hearts: body.max_hearts,
            gold: body.gold,
            status: body.status,
            last_weekend_reset_at: body.last_weekend_reset_at,
        });

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ok: true,
                class_id,
                student_id,
            }),
        };
    } catch (err: any) {
        console.error("Error upserting player state:", err);
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

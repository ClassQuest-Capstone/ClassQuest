import { updateBossBattleInstance } from "./repo.js";
import { validateUpdateBattleInput } from "./validation.js";
import type { UpdateBossBattleInstanceInput } from "./types.js";

/**
 * PATCH /boss-battle-instances/{boss_instance_id}
 * Update a boss battle instance (status, HP, timers, etc.)
 *
 * Authorization: TEACHER, ADMIN only
 */
export const handler = async (event: any) => {
    try {
        const boss_instance_id = event.pathParameters?.boss_instance_id;

        if (!boss_instance_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing boss_instance_id path parameter" }),
            };
        }

        // Authorization: Only teachers and admins can update
        const userRole = event.requestContext?.authorizer?.jwt?.claims?.["cognito:groups"] as string | undefined;
        const userId = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined;

        if (!userId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized: Missing user identity" }),
            };
        }

        const allowedRoles = ["Teachers", "Admins"];
        const hasPermission = userRole?.split(",").some(role => allowedRoles.includes(role.trim()));

        if (!hasPermission) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Forbidden: Only teachers and admins can update boss battles" }),
            };
        }

        // Parse request body
        const rawBody = event.body;
        const body = typeof rawBody === "string" && rawBody.length ? JSON.parse(rawBody) : rawBody ?? {};

        const updates: UpdateBossBattleInstanceInput = {
            status: body.status,
            current_boss_hp: body.current_boss_hp,
            lobby_opened_at: body.lobby_opened_at,
            countdown_seconds: body.countdown_seconds,
            countdown_end_at: body.countdown_end_at,
            active_question_id: body.active_question_id,
            question_started_at: body.question_started_at,
            question_ends_at: body.question_ends_at,
            intermission_ends_at: body.intermission_ends_at,
            completed_at: body.completed_at,
            current_question_index: body.current_question_index,
            per_guild_question_index: body.per_guild_question_index,
            active_guild_id: body.active_guild_id,
            outcome: body.outcome,
            fail_reason: body.fail_reason,
            participants_snapshot_id: body.participants_snapshot_id,
            question_plan_id: body.question_plan_id,
            guild_question_plan_id: body.guild_question_plan_id,
        };

        // Validate updates
        const validation = validateUpdateBattleInput(updates);
        if (!validation.valid) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: validation.error }),
            };
        }

        // Set updated_at
        const now = new Date().toISOString();

        // Update the instance
        await updateBossBattleInstance(boss_instance_id, {
            ...updates,
            updated_at: now,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Boss battle instance updated successfully",
                boss_instance_id,
                updated_at: now,
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Boss battle instance not found" }),
            };
        }

        console.error("Error updating boss battle instance:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

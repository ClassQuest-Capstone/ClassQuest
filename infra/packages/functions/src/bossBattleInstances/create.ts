import { randomUUID } from "crypto";
import { createBossBattleInstance } from "./repo.js";
import { validateCreateBattleInput } from "./validation.js";
import { applyBattleDefaults, type CreateBossBattleInstanceInput, type BossBattleInstanceItem } from "./types.js";

/**
 * POST /boss-battle-instances
 * Create a new boss battle instance
 *
 * Authorization: TEACHER, ADMIN only
 */
export const handler = async (event: any) => {
    try {
        // Authorization: Only teachers and admins can create
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
                body: JSON.stringify({ error: "Forbidden: Only teachers and admins can create boss battles" }),
            };
        }

        // Parse request body
        const rawBody = event.body;
        const body = typeof rawBody === "string" && rawBody.length ? JSON.parse(rawBody) : rawBody ?? {};

        const input: CreateBossBattleInstanceInput = {
            class_id: body.class_id,
            boss_template_id: body.boss_template_id,
            created_by_teacher_id: userId, // Derive from auth principal
            initial_boss_hp: body.initial_boss_hp,
            mode_type: body.mode_type,
            question_selection_mode: body.question_selection_mode,
            speed_bonus_enabled: body.speed_bonus_enabled,
            speed_bonus_floor_multiplier: body.speed_bonus_floor_multiplier,
            speed_window_seconds: body.speed_window_seconds,
            time_limit_seconds_default: body.time_limit_seconds_default,
            anti_spam_min_submit_interval_ms: body.anti_spam_min_submit_interval_ms,
            freeze_on_wrong_seconds: body.freeze_on_wrong_seconds,
            late_join_policy: body.late_join_policy,
            turn_policy: body.turn_policy,
        };

        // Validate input
        const validation = validateCreateBattleInput(input);
        if (!validation.valid) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: validation.error }),
            };
        }

        // Apply defaults
        const itemWithDefaults = applyBattleDefaults(input);

        // Generate IDs and timestamps
        const boss_instance_id = randomUUID();
        const now = new Date().toISOString();

        const item: BossBattleInstanceItem = {
            boss_instance_id,
            ...itemWithDefaults,
            created_at: now,
            updated_at: now,
        };

        // Create the instance
        await createBossBattleInstance(item);

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: "Boss battle instance created successfully",
                boss_instance_id,
                status: item.status,
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "Boss battle instance already exists" }),
            };
        }

        console.error("Error creating boss battle instance:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

import { randomUUID } from "crypto";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { BossQuestionItem } from "./types.ts";
import { createQuestion } from "./repo.ts";
import { makeOrderKey } from "./keys.ts";
import { validateQuestion } from "./validation.ts";
import { getTemplate as getBossTemplate } from "../bossBattleTemplates/repo.ts";

/**
 * POST /boss-templates/{boss_template_id}/questions
 * Create a new question for a boss template
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        // Step 1: Extract boss_template_id from path
        const boss_template_id = event.pathParameters?.boss_template_id;

        if (!boss_template_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing boss_template_id in path" }),
            };
        }

        // Step 2: Parse request body
        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const {
            order_index,
            question_text,
            question_type,
            options,
            correct_answer,
            damage_to_boss_on_correct,
            damage_to_guild_on_incorrect,
            max_points,
            xp_reward,
            auto_gradable,
            time_limit_seconds,
            image_asset_key,
        } = body;

        // Step 3: Validate required fields
        if (
            order_index === undefined ||
            !question_text ||
            !question_type ||
            auto_gradable === undefined
        ) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required fields",
                    required: [
                        "order_index",
                        "question_text",
                        "question_type",
                        "auto_gradable",
                    ],
                }),
            };
        }

        // Step 3b: Guard — reject if the template is deleted or missing
        const template = await getBossTemplate(boss_template_id);
        if (!template) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Boss battle template not found or has been deleted",
                }),
            };
        }

        // Step 4: Comprehensive validation
        const validation = validateQuestion({
            order_index,
            question_text,
            question_type,
            damage_to_boss_on_correct,
            damage_to_guild_on_incorrect,
            auto_gradable,
            correct_answer,
            max_points,
            time_limit_seconds,
        });

        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: validation.error,
                }),
            };
        }

        // Step 5: Derive order_key from order_index
        let order_key: string;
        try {
            order_key = makeOrderKey(order_index);
        } catch (error: any) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: error.message,
                }),
            };
        }

        // Step 6: Create the question item
        const question_id = randomUUID();
        const now = new Date().toISOString();

        const item: BossQuestionItem = {
            question_id,
            boss_template_id,
            order_index,
            order_key,
            question_text: question_text.trim(),
            question_type,
            options,
            correct_answer,
            damage_to_boss_on_correct,
            damage_to_guild_on_incorrect,
            max_points,
            ...(xp_reward !== undefined && { xp_reward }),
            auto_gradable,
            ...(time_limit_seconds !== undefined && { time_limit_seconds }),
            ...(image_asset_key ? { image_asset_key } : {}),
            created_at: now,
            updated_at: now,
        };

        await createQuestion(item);

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                question_id,
                order_key,
                message: "Boss question created successfully",
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Question with this ID already exists",
                }),
            };
        }

        console.error("Error creating boss question:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: error.message || "Internal server error",
            }),
        };
    }
};

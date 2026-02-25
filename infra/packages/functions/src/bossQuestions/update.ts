import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { updateQuestion } from "./repo.ts";
import { makeOrderKey } from "./keys.ts";
import { validateQuestion } from "./validation.ts";

/**
 * PATCH /boss-questions/{question_id}
 * Update a boss question
 * Allows updating any mutable fields
 * If order_index changes, recomputes order_key
 * Always sets updated_at to now
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const question_id = event.pathParameters?.question_id;

        if (!question_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing question_id in path" }),
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
            auto_gradable,
            time_limit_seconds,
        } = body;

        // Step 3: Validate updates
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

        // Step 4: Build update object
        const updates: any = {};

        if (order_index !== undefined) {
            try {
                updates.order_index = order_index;
                updates.order_key = makeOrderKey(order_index);
            } catch (error: any) {
                return {
                    statusCode: 400,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        error: error.message,
                    }),
                };
            }
        }

        if (question_text !== undefined) {
            updates.question_text = question_text.trim();
        }

        if (question_type !== undefined) {
            updates.question_type = question_type;
        }

        if (options !== undefined) {
            updates.options = options;
        }

        if (correct_answer !== undefined) {
            updates.correct_answer = correct_answer;
        }

        if (damage_to_boss_on_correct !== undefined) {
            updates.damage_to_boss_on_correct = damage_to_boss_on_correct;
        }

        if (damage_to_guild_on_incorrect !== undefined) {
            updates.damage_to_guild_on_incorrect = damage_to_guild_on_incorrect;
        }

        if (max_points !== undefined) {
            updates.max_points = max_points;
        }

        if (auto_gradable !== undefined) {
            updates.auto_gradable = auto_gradable;
        }

        if (time_limit_seconds !== undefined) {
            updates.time_limit_seconds = time_limit_seconds;
        }

        // Always set updated_at
        updates.updated_at = new Date().toISOString();

        // Step 5: Update the question
        await updateQuestion(question_id, updates);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                question_id,
                message: "Boss question updated successfully",
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Question not found",
                }),
            };
        }

        console.error("Error updating boss question:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: error.message || "Internal server error",
            }),
        };
    }
};

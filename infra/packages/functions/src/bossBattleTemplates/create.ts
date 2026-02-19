import { randomUUID } from "crypto";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { BossBattleTemplateItem } from "./types.ts";
import { createTemplate } from "./repo.ts";
import { makePublicSort } from "./keys.ts";
import { validateTemplate } from "./validation.ts";

/**
 * POST /boss-battle-templates
 * Create a new boss battle template
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        // Step 1: Parse request body
        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const {
            owner_teacher_id,
            title,
            description,
            subject,
            max_hp,
            base_xp_reward,
            base_gold_reward,
            is_shared_publicly,
        } = body;

        // Step 2: Validate required fields
        if (
            !owner_teacher_id ||
            !title ||
            description === undefined ||
            max_hp === undefined ||
            base_xp_reward === undefined ||
            base_gold_reward === undefined ||
            is_shared_publicly === undefined
        ) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required fields",
                    required: [
                        "owner_teacher_id",
                        "title",
                        "description",
                        "max_hp",
                        "base_xp_reward",
                        "base_gold_reward",
                        "is_shared_publicly",
                    ],
                }),
            };
        }

        // Step 3: Comprehensive validation
        const validation = validateTemplate({
            title,
            description,
            max_hp,
            base_xp_reward,
            base_gold_reward,
            is_shared_publicly,
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

        // Step 4: Create the template item
        const boss_template_id = randomUUID();
        const now = new Date().toISOString();
        const public_sort = makePublicSort(subject, now, boss_template_id);

        const item: BossBattleTemplateItem = {
            boss_template_id,
            owner_teacher_id,
            title: title.trim(),
            description: description.trim(),
            subject,
            max_hp,
            base_xp_reward,
            base_gold_reward,
            is_shared_publicly,
            public_sort,
            created_at: now,
            updated_at: now,
        };

        await createTemplate(item);

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                boss_template_id,
                message: "Boss battle template created successfully",
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Template with this ID already exists",
                }),
            };
        }

        console.error("Error creating boss battle template:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: error.message || "Internal server error",
            }),
        };
    }
};

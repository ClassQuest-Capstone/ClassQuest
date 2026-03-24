import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { AvatarBase } from "./types.ts";
import { createBase } from "./repo.ts";
import { validateAvatarBase } from "./validation.ts";

/**
 * POST /avatar-bases
 *
 * Create a new AvatarBase configuration record.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const {
            avatar_base_id,
            gender,
            role_type,
            is_default,
            default_helmet_item_id,
            default_armour_item_id,
            default_shield_item_id,
            default_pet_item_id,
            default_background_item_id,
        } = body;

        // Required fields check
        if (
            !avatar_base_id ||
            !gender ||
            !role_type ||
            is_default === undefined
        ) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required fields",
                    required: ["avatar_base_id", "gender", "role_type", "is_default"],
                }),
            };
        }

        const validation = validateAvatarBase({
            avatar_base_id,
            gender,
            role_type,
            is_default,
            default_helmet_item_id,
            default_armour_item_id,
            default_shield_item_id,
            default_pet_item_id,
            default_background_item_id,
        });

        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: validation.error }),
            };
        }

        const now = new Date().toISOString();

        const base: AvatarBase = {
            avatar_base_id: avatar_base_id.trim(),
            gender,
            role_type,
            is_default,
            ...(default_helmet_item_id    !== undefined && { default_helmet_item_id:    default_helmet_item_id.trim() }),
            ...(default_armour_item_id    !== undefined && { default_armour_item_id:    default_armour_item_id.trim() }),
            ...(default_shield_item_id    !== undefined && { default_shield_item_id:    default_shield_item_id.trim() }),
            ...(default_pet_item_id       !== undefined && { default_pet_item_id:       default_pet_item_id.trim() }),
            ...(default_background_item_id !== undefined && { default_background_item_id: default_background_item_id.trim() }),
            created_at: now,
            updated_at: now,
        };

        await createBase(base);

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                avatar_base_id,
                message: "Avatar base created successfully",
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "An avatar base with this avatar_base_id already exists" }),
            };
        }

        console.error("Error creating avatar base:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

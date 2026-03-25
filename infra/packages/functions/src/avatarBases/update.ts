import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { updateBase } from "./repo.ts";
import { validateAvatarBase } from "./validation.ts";

/**
 * PATCH /avatar-bases/{avatar_base_id}
 *
 * Update mutable fields on an AvatarBase.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const avatar_base_id = event.pathParameters?.avatar_base_id;

        if (!avatar_base_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing avatar_base_id in path" }),
            };
        }

        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const {
            gender,
            role_type,
            is_default,
            color_type,
            default_character_image_key,
            default_helmet_item_id,
            default_armour_item_id,
            default_shield_item_id,
            default_pet_item_id,
            default_background_item_id,
        } = body;

        if (
            gender === undefined &&
            role_type === undefined &&
            is_default === undefined &&
            color_type === undefined &&
            default_character_image_key === undefined &&
            default_helmet_item_id === undefined &&
            default_armour_item_id === undefined &&
            default_shield_item_id === undefined &&
            default_pet_item_id === undefined &&
            default_background_item_id === undefined
        ) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "No updatable fields provided" }),
            };
        }

        const validation = validateAvatarBase({
            gender,
            role_type,
            is_default,
            color_type,
            default_character_image_key,
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

        const updated = await updateBase(avatar_base_id, {
            gender,
            role_type,
            is_default,
            color_type,
            default_character_image_key,
            default_helmet_item_id,
            default_armour_item_id,
            default_shield_item_id,
            default_pet_item_id,
            default_background_item_id,
            updated_at: now,
        });

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(updated),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Avatar base not found" }),
            };
        }

        console.error("Error updating avatar base:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

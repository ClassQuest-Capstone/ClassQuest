import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { updateAvatar } from "./repo.ts";
import { validatePlayerAvatar } from "./validation.ts";

/**
 * PATCH /player-avatars/{player_avatar_id}
 *
 * Update mutable fields on a PlayerAvatar (avatar_base_id, gender, equipped slots).
 * For slot-level equip/unequip with validation, use the /equip and /unequip endpoints.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const player_avatar_id = event.pathParameters?.player_avatar_id;

        if (!player_avatar_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing player_avatar_id in path" }),
            };
        }

        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const {
            avatar_base_id,
            gender,
            equipped_helmet_item_id,
            equipped_armour_item_id,
            equipped_shield_item_id,
            equipped_pet_item_id,
            equipped_background_item_id,
        } = body;

        if (
            avatar_base_id === undefined &&
            gender === undefined &&
            equipped_helmet_item_id === undefined &&
            equipped_armour_item_id === undefined &&
            equipped_shield_item_id === undefined &&
            equipped_pet_item_id === undefined &&
            equipped_background_item_id === undefined
        ) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "No updatable fields provided" }),
            };
        }

        const validation = validatePlayerAvatar({
            avatar_base_id,
            gender,
            equipped_helmet_item_id,
            equipped_armour_item_id,
            equipped_shield_item_id,
            equipped_pet_item_id,
            equipped_background_item_id,
        });

        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: validation.error }),
            };
        }

        const now = new Date().toISOString();

        const updated = await updateAvatar(player_avatar_id, {
            avatar_base_id,
            gender,
            equipped_helmet_item_id,
            equipped_armour_item_id,
            equipped_shield_item_id,
            equipped_pet_item_id,
            equipped_background_item_id,
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
                body: JSON.stringify({ error: "Player avatar not found" }),
            };
        }

        console.error("Error updating player avatar:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

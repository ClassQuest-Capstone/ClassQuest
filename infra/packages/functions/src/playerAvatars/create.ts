import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import type { PlayerAvatar } from "./types.ts";
import { createAvatar, makeGsi1Pk, makeGsi1Sk } from "./repo.ts";
import { validatePlayerAvatar } from "./validation.ts";

/**
 * POST /player-avatars
 *
 * Create a new PlayerAvatar state record for a student in a class.
 * One record per student per class. Returns 409 if a record already exists
 * for this player_avatar_id (callers should check for existing records first
 * using GET /player-avatars/class/{class_id}/student/{student_id}).
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const {
            class_id,
            student_id,
            avatar_base_id,
            gender,
            equipped_helmet_item_id,
            equipped_armour_item_id,
            equipped_shield_item_id,
            equipped_pet_item_id,
            equipped_background_item_id,
        } = body;

        if (!class_id || !student_id || !avatar_base_id || !gender) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required fields",
                    required: ["class_id", "student_id", "avatar_base_id", "gender"],
                }),
            };
        }

        const validation = validatePlayerAvatar({
            class_id,
            student_id,
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

        const player_avatar_id = randomUUID();
        const now = new Date().toISOString();

        const avatar: PlayerAvatar = {
            player_avatar_id,
            class_id,
            student_id,
            avatar_base_id,
            gender,
            ...(equipped_helmet_item_id    !== undefined && { equipped_helmet_item_id }),
            ...(equipped_armour_item_id    !== undefined && { equipped_armour_item_id }),
            ...(equipped_shield_item_id    !== undefined && { equipped_shield_item_id }),
            ...(equipped_pet_item_id       !== undefined && { equipped_pet_item_id }),
            ...(equipped_background_item_id !== undefined && { equipped_background_item_id }),
            gsi1pk: makeGsi1Pk(class_id),
            gsi1sk: makeGsi1Sk(student_id),
            updated_at: now,
        };

        await createAvatar(avatar);

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                player_avatar_id,
                student_id,
                class_id,
                message: "Player avatar created successfully",
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "A player avatar with this id already exists" }),
            };
        }

        console.error("Error creating player avatar:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

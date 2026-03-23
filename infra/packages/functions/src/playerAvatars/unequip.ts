import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getAvatar, updateAvatar } from "./repo.ts";
import { getBase as getAvatarBase } from "../avatarBases/repo.ts";
import { VALID_GEAR_SLOTS } from "./validation.ts";
import type { GearSlot } from "./types.ts";

// Maps gear slot → AvatarBases default field name
const SLOT_TO_DEFAULT_FIELD: Record<GearSlot, string> = {
    helmet:     "default_helmet_item_id",
    armour:     "default_armour_item_id",
    shield:     "default_shield_item_id",
    pet:        "default_pet_item_id",
    background: "default_background_item_id",
};

/**
 * POST /player-avatars/{player_avatar_id}/unequip
 *
 * Unequip a gear slot for this avatar.
 * Resets the slot to the AvatarBases default item id for the avatar's base.
 * If the base has no default for this slot, the field is cleared (set to undefined).
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

        const { slot } = body;

        if (!slot) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing required field: slot" }),
            };
        }

        if (!VALID_GEAR_SLOTS.includes(slot as GearSlot)) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: `slot must be one of: ${VALID_GEAR_SLOTS.join(", ")}`,
                }),
            };
        }

        // Step 1: Fetch the avatar record to get avatar_base_id
        const avatar = await getAvatar(player_avatar_id);
        if (!avatar) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Player avatar not found" }),
            };
        }

        // Step 2: Fetch AvatarBases to get the default item id for this slot
        const avatarBase = await getAvatarBase(avatar.avatar_base_id);

        const defaultField = SLOT_TO_DEFAULT_FIELD[slot as GearSlot] as keyof typeof avatarBase;
        const defaultItemId = avatarBase
            ? (avatarBase[defaultField] as string | undefined)
            : undefined;

        // Step 3: Reset the slot to the default (or clear it if no default)
        const slotField = `equipped_${slot}_item_id`;
        const now = new Date().toISOString();

        // If there's a default, set the slot to it; otherwise use DynamoDB REMOVE
        let updated;
        if (defaultItemId) {
            updated = await updateAvatar(player_avatar_id, {
                [slotField]: defaultItemId,
                updated_at: now,
            });
        } else {
            // No default — clear the field
            updated = await updateAvatar(player_avatar_id, {
                [slotField]: undefined,
                updated_at: now,
            });
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ...updated,
                unequipped_slot: slot,
                reset_to: defaultItemId ?? null,
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Player avatar not found" }),
            };
        }

        console.error("Error unequipping item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

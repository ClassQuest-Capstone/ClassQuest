import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getAvatar, updateAvatar } from "./repo.ts";
import { getInventoryItem } from "../inventoryItems/repo.ts";
import { getItem as getShopItem } from "../shopItems/repo.ts";
import { VALID_GEAR_SLOTS, SLOT_TO_SHOP_CATEGORY } from "./validation.ts";
import type { GearSlot } from "./types.ts";

/**
 * POST /player-avatars/{player_avatar_id}/equip
 *
 * Equip an item in a specific gear slot for this avatar.
 *
 * Validates:
 * - slot is a valid gear slot
 * - item is owned by the student (InventoryItems)
 * - item category matches the requested slot (ShopItems)
 * - item gender is compatible with avatar gender or is UNISEX (ShopItems)
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

        const { slot, item_id } = body;

        if (!slot || !item_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required fields",
                    required: ["slot", "item_id"],
                }),
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

        // Step 1: Fetch the avatar record to get student_id, class_id, and gender
        const avatar = await getAvatar(player_avatar_id);
        if (!avatar) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Player avatar not found" }),
            };
        }

        // Step 2: Verify the student owns the item
        const inventoryItem = await getInventoryItem(avatar.student_id, item_id);
        if (!inventoryItem) {
            return {
                statusCode: 403,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Student does not own this item" }),
            };
        }

        // Step 3: Verify item metadata — category must match the slot, gender must be compatible
        const shopItem = await getShopItem(item_id);
        if (!shopItem) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Item not found in shop catalogue" }),
            };
        }

        const expectedCategory = SLOT_TO_SHOP_CATEGORY[slot as GearSlot];
        if (shopItem.category !== expectedCategory) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: `Item category ${shopItem.category} does not match slot ${slot} (expected ${expectedCategory})`,
                }),
            };
        }

        // Gender compatibility: item must be UNISEX or match the avatar's gender
        if (shopItem.gender && shopItem.gender !== "UNISEX" && shopItem.gender !== avatar.gender) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: `Item gender ${shopItem.gender} is not compatible with avatar gender ${avatar.gender}`,
                }),
            };
        }

        // Step 4: Update the equipped slot
        const slotField = `equipped_${slot}_item_id` as keyof typeof avatar;
        const now = new Date().toISOString();

        const updated = await updateAvatar(player_avatar_id, {
            [slotField]: item_id,
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

        console.error("Error equipping item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

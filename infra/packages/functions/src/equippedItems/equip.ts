import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getEquippedItemsById, updateEquippedItems } from "./repo.ts";
import { getInventoryItem } from "../inventoryItems/repo.ts";
import { getItem as getShopItem } from "../shopItems/repo.ts";
import { getBase as getAvatarBase } from "../avatarBases/repo.ts";
import { VALID_EQUIP_SLOTS, SLOT_TO_SHOP_CATEGORY } from "./validation.ts";
import type { EquipSlot } from "./types.ts";

/**
 * POST /equipped-items/{equipped_id}/equip
 *
 * Equip an item in a specific slot for this equipped-items record.
 *
 * Validates:
 * - slot is a valid equip slot
 * - item is owned by the student (InventoryItems)
 * - item category matches the requested slot (ShopItems)
 * - item gender is compatible with avatar gender (from AvatarBases) or is UNISEX
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const equipped_id = event.pathParameters?.equipped_id;

        if (!equipped_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing equipped_id in path" }),
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

        if (!VALID_EQUIP_SLOTS.includes(slot as EquipSlot)) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: `slot must be one of: ${VALID_EQUIP_SLOTS.join(", ")}`,
                }),
            };
        }

        // Step 1: Fetch the EquippedItems record to get student_id and avatar_base_id
        const record = await getEquippedItemsById(equipped_id);
        if (!record) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "EquippedItems record not found" }),
            };
        }

        // Step 2: Verify the student owns the item
        const inventoryItem = await getInventoryItem(record.student_id, item_id);
        if (!inventoryItem) {
            return {
                statusCode: 403,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Student does not own this item" }),
            };
        }

        // Step 3: Verify item metadata — category must match the slot
        const shopItem = await getShopItem(item_id);
        if (!shopItem) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Item not found in shop catalogue" }),
            };
        }

        const expectedCategory = SLOT_TO_SHOP_CATEGORY[slot as EquipSlot];
        if (shopItem.category !== expectedCategory) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: `Item category ${shopItem.category} does not match slot ${slot} (expected ${expectedCategory})`,
                }),
            };
        }

        // Step 4: Gender compatibility — read AvatarBases to get avatar gender
        const avatarBase = await getAvatarBase(record.avatar_base_id);
        const avatarGender = avatarBase?.gender;

        if (shopItem.gender && shopItem.gender !== "UNISEX" && avatarGender && shopItem.gender !== avatarGender) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: `Item gender ${shopItem.gender} is not compatible with avatar gender ${avatarGender}`,
                }),
            };
        }

        // Step 5: Update the equipped slot (slot "helmet" → field "helmet_item_id")
        const slotField = `${slot}_item_id` as keyof typeof record;
        const now = new Date().toISOString();

        const updated = await updateEquippedItems(equipped_id, {
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
                body: JSON.stringify({ error: "EquippedItems record not found" }),
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

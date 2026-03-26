import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getEquippedItemsById, updateEquippedItems, clearSlotField } from "./repo.ts";
import { getBase as getAvatarBase } from "../avatarBases/repo.ts";
import { VALID_EQUIP_SLOTS, SLOT_TO_DEFAULT_FIELD } from "./validation.ts";
import type { EquipSlot } from "./types.ts";

/**
 * POST /equipped-items/{equipped_id}/unequip
 *
 * Unequip a slot for this EquippedItems record.
 * Resets the slot to the AvatarBases default item id for the avatar's base.
 * If the base has no default for this slot, the field is removed from the record.
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

        const { slot } = body;

        if (!slot) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing required field: slot" }),
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

        // Step 1: Fetch the EquippedItems record to get avatar_base_id
        const record = await getEquippedItemsById(equipped_id);
        if (!record) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "EquippedItems record not found" }),
            };
        }

        // Step 2: Fetch AvatarBases to get the default item id for this slot
        const avatarBase = await getAvatarBase(record.avatar_base_id);

        const defaultField = SLOT_TO_DEFAULT_FIELD[slot as EquipSlot] as keyof typeof avatarBase;
        const defaultItemId = avatarBase
            ? (avatarBase[defaultField] as string | undefined)
            : undefined;

        // Step 3: Reset the slot to the default, or REMOVE it if no default exists
        const slotField = `${slot}_item_id`;
        const now = new Date().toISOString();

        let updated;
        if (defaultItemId) {
            updated = await updateEquippedItems(equipped_id, {
                [slotField]: defaultItemId,
                updated_at: now,
            });
        } else {
            // No default — remove the attribute from DynamoDB
            updated = await clearSlotField(equipped_id, slotField, now);
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
                body: JSON.stringify({ error: "EquippedItems record not found" }),
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

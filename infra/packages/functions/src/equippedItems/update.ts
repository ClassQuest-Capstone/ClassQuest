import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { updateEquippedItems } from "./repo.ts";

/**
 * PATCH /equipped-items/{equipped_id}
 *
 * Generic update for slot fields and avatar_base_id.
 * Does not allow changing equipped_id, class_id, student_id, gsi1pk, gsi1sk, or equipped_at.
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

        const {
            avatar_base_id,
            helmet_item_id,
            armour_item_id,
            hand_item_id,
            pet_item_id,
            background_item_id,
        } = body;

        // At least one updatable field must be provided
        if (
            avatar_base_id      === undefined &&
            helmet_item_id      === undefined &&
            armour_item_id      === undefined &&
            hand_item_id        === undefined &&
            pet_item_id         === undefined &&
            background_item_id  === undefined
        ) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "No updatable fields provided" }),
            };
        }

        // Validate that any provided slot IDs are non-empty strings
        const slotFields: Record<string, any> = {
            avatar_base_id,
            helmet_item_id,
            armour_item_id,
            hand_item_id,
            pet_item_id,
            background_item_id,
        };
        for (const [field, value] of Object.entries(slotFields)) {
            if (value !== undefined) {
                if (typeof value !== "string" || value.trim().length === 0) {
                    return {
                        statusCode: 400,
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ error: `${field} must be a non-empty string` }),
                    };
                }
            }
        }

        const now = new Date().toISOString();

        const updated = await updateEquippedItems(equipped_id, {
            avatar_base_id,
            helmet_item_id,
            armour_item_id,
            hand_item_id,
            pet_item_id,
            background_item_id,
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

        console.error("Error updating equipped items:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

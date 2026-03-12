import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { InventoryItem } from "./types.ts";
import { createInventoryItem, getInventoryItem, incrementQuantity } from "./repo.ts";
import { buildAllInventoryKeys } from "./keys.ts";
import { validateInventoryItem } from "./validation.ts";
import { randomUUID } from "crypto";

/**
 * POST /inventory-items/grant
 *
 * Teacher/admin grant endpoint — create-or-increment.
 * - If the student does not own the item: creates a new ownership record.
 * - If the student already owns the item: increments the quantity.
 *
 * This is the recommended way to grant items from reward flows.
 * Use POST /inventory-items if you need strict uniqueness enforcement (409 on duplicate).
 *
 * Request body:
 *   student_id           required
 *   class_id             required
 *   item_id              required
 *   quantity             optional (default 1)
 *   acquired_from        optional (default "ADMIN_GRANT")
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const {
            student_id,
            class_id,
            item_id,
            quantity = 1,
            acquired_from = "ADMIN_GRANT",
        } = body;

        if (!student_id || !class_id || !item_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required fields",
                    required: ["student_id", "class_id", "item_id"],
                }),
            };
        }

        const validation = validateInventoryItem({ student_id, class_id, item_id, quantity, acquired_from });
        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: validation.error }),
            };
        }

        const now = new Date().toISOString();

        // Attempt create first
        const keys = buildAllInventoryKeys({ student_id, class_id, item_id });
        const newItem: InventoryItem = {
            ...keys,
            inventory_item_id: randomUUID(),
            student_id,
            class_id,
            item_id,
            quantity,
            acquired_from,
            acquired_at: now,
            updated_at:  now,
        };

        try {
            await createInventoryItem(newItem);
            return {
                statusCode: 201,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    action:            "created",
                    inventory_item_id: newItem.inventory_item_id,
                    student_id,
                    item_id,
                    quantity:          newItem.quantity,
                    message:           "Item granted and ownership record created",
                }),
            };
        } catch (createErr: any) {
            if (createErr.name !== "ConditionalCheckFailedException") {
                throw createErr;
            }
        }

        // Student already owns item — increment quantity
        const updated = await incrementQuantity(student_id, item_id, quantity, now);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                action:            "incremented",
                inventory_item_id: updated.inventory_item_id,
                student_id,
                item_id,
                quantity:          updated.quantity,
                message:           "Item already owned; quantity incremented",
            }),
        };
    } catch (error: any) {
        console.error("Error granting inventory item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

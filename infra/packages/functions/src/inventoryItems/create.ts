import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { InventoryItem } from "./types.ts";
import { createInventoryItem } from "./repo.ts";
import { buildAllInventoryKeys } from "./keys.ts";
import { validateInventoryItem } from "./validation.ts";
import { randomUUID } from "crypto";

/**
 * POST /inventory-items
 *
 * Create a new inventory ownership record for a student.
 * Intended for admin grant, reward grant, or migration flows.
 * Returns 409 if the student already owns the item (use /grant to increment).
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const { student_id, class_id, item_id, quantity, acquired_from, acquired_at } = body;

        // Required fields
        if (!student_id || !class_id || !item_id || quantity === undefined || !acquired_from) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required fields",
                    required: ["student_id", "class_id", "item_id", "quantity", "acquired_from"],
                }),
            };
        }

        const validation = validateInventoryItem({
            student_id, class_id, item_id, quantity, acquired_from,
            acquired_at: acquired_at ?? new Date().toISOString(),
        });

        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: validation.error }),
            };
        }

        const keys = buildAllInventoryKeys({ student_id, class_id, item_id });
        const now = new Date().toISOString();

        const item: InventoryItem = {
            ...keys,
            inventory_item_id: randomUUID(),
            student_id,
            class_id,
            item_id,
            quantity,
            acquired_from,
            acquired_at: acquired_at ?? now,
            updated_at: now,
        };

        await createInventoryItem(item);

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                inventory_item_id: item.inventory_item_id,
                student_id,
                item_id,
                message: "Inventory item created successfully",
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Student already owns this item. Use the grant endpoint to increment quantity.",
                }),
            };
        }

        console.error("Error creating inventory item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getInventoryItem, updateInventoryItem } from "./repo.ts";
import { buildInventoryItemGsi1Pk, buildInventoryItemGsi1Sk, buildInventoryItemGsi2Sk } from "./keys.ts";
import { validateInventoryItem } from "./validation.ts";

/**
 * PUT /inventory-items/{student_id}/{item_id}
 *
 * Update mutable fields on an InventoryItem.
 * Immutable fields: student_id, item_id, inventory_item_id, acquired_at.
 *
 * If class_id changes, GSI1PK, GSI1SK, and GSI2SK are recomputed automatically.
 * PK and SK are never changed (they are based on student_id + item_id).
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const student_id = event.pathParameters?.student_id;
        const item_id    = event.pathParameters?.item_id;

        if (!student_id || !item_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing student_id or item_id in path" }),
            };
        }

        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const { quantity, acquired_from, class_id } = body;

        if (quantity === undefined && acquired_from === undefined && class_id === undefined) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "No updatable fields provided" }),
            };
        }

        const validation = validateInventoryItem({ quantity, acquired_from, class_id });
        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: validation.error }),
            };
        }

        // If class_id is changing, fetch current record to rebuild GSI keys
        let gsiKeyUpdates: {
            GSI1PK: string;
            GSI1SK: string;
            GSI2SK: string;
        } | undefined;

        if (class_id !== undefined) {
            const current = await getInventoryItem(student_id, item_id);
            if (!current) {
                return {
                    statusCode: 404,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ error: "Inventory item not found" }),
                };
            }

            gsiKeyUpdates = {
                GSI1PK: buildInventoryItemGsi1Pk(class_id),
                GSI1SK: buildInventoryItemGsi1Sk(student_id, item_id),
                GSI2SK: buildInventoryItemGsi2Sk(class_id, student_id),
            };
        }

        const now = new Date().toISOString();

        const updated = await updateInventoryItem(student_id, item_id, {
            quantity,
            acquired_from,
            class_id,
            ...(gsiKeyUpdates ?? {}),
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
                body: JSON.stringify({ error: "Inventory item not found" }),
            };
        }

        console.error("Error updating inventory item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

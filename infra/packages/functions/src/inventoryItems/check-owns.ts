import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getInventoryItem } from "./repo.ts";

/**
 * GET /inventory-items/owns/{student_id}/{item_id}
 *
 * Ownership check — returns whether a student owns a given item and the current quantity.
 * Uses direct PK/SK lookup (O(1)).
 *
 * Response:
 *   { owned: true,  quantity: N, inventory_item_id: "..." }
 *   { owned: false, quantity: 0 }
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

        const item = await getInventoryItem(student_id, item_id);

        if (!item) {
            return {
                statusCode: 200,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ owned: false, quantity: 0 }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                owned:             true,
                quantity:          item.quantity,
                inventory_item_id: item.inventory_item_id,
            }),
        };
    } catch (error: any) {
        console.error("Error checking item ownership:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

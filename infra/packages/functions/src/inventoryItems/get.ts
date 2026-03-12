import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getInventoryItem } from "./repo.ts";

/**
 * GET /inventory-items/{student_id}/{item_id}
 *
 * Fetch one inventory ownership record by student_id + item_id.
 * Direct PK/SK lookup — O(1).
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
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Inventory item not found" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(item),
        };
    } catch (error: any) {
        console.error("Error getting inventory item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

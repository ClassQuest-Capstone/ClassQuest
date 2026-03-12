import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { deleteInventoryItem } from "./repo.ts";

/**
 * DELETE /inventory-items/{student_id}/{item_id}
 *
 * Permanently remove an inventory ownership record.
 * Teacher/admin only — used for corrections and admin revocations.
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

        await deleteInventoryItem(student_id, item_id);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                message:    "Inventory item deleted successfully",
                student_id,
                item_id,
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Inventory item not found" }),
            };
        }

        console.error("Error deleting inventory item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

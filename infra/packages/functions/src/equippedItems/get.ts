import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getEquippedItemsById } from "./repo.ts";

/**
 * GET /equipped-items/{equipped_id}
 *
 * Fetch a single EquippedItems record by its primary key.
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

        const record = await getEquippedItemsById(equipped_id);

        if (!record) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "EquippedItems record not found" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(record),
        };
    } catch (error: any) {
        console.error("Error fetching equipped items:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

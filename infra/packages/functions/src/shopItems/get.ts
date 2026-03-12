import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getItem } from "./repo.ts";

/**
 * GET /shop-items/{item_id}
 *
 * Fetch a single ShopItem definition by its item_id.
 * Returns the full item record including GSI key fields.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const item_id = event.pathParameters?.item_id;

        if (!item_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing item_id in path" }),
            };
        }

        const item = await getItem(item_id);

        if (!item) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Shop item not found" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(item),
        };
    } catch (error: any) {
        console.error("Error getting shop item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

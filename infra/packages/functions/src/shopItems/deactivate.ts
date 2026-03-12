import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { setActiveStatus } from "./repo.ts";

/**
 * PATCH /shop-items/{item_id}/deactivate
 *
 * Mark a ShopItem as inactive (is_active = false).
 * The item moves from the SHOP#ACTIVE GSI1 bucket to SHOP#INACTIVE,
 * making it invisible in all active-item listing queries.
 *
 * Idempotent: deactivating an already-inactive item succeeds with no side effects.
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

        const updated = await setActiveStatus(item_id, false, new Date().toISOString());

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ok: true, item: updated }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Shop item not found" }),
            };
        }

        console.error("Error deactivating shop item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

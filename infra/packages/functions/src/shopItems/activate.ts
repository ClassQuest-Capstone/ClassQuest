import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { setActiveStatus } from "./repo.ts";

/**
 * PATCH /shop-items/{item_id}/activate
 *
 * Mark a ShopItem as active (is_active = true).
 * The item moves from the SHOP#INACTIVE GSI1 bucket back to SHOP#ACTIVE,
 * making it visible again in all active-item listing queries.
 *
 * Idempotent: activating an already-active item succeeds with no side effects.
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

        const updated = await setActiveStatus(item_id, true, new Date().toISOString());

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

        console.error("Error activating shop item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

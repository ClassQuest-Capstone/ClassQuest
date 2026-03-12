import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listListingsByItem } from "./repo.ts";

/**
 * GET /shop-listings/item/{item_id}
 *
 * List all ShopListings for a given item_id across all scopes and active states.
 * Uses GSI2 (partitioned on GSI2PK = "ITEM#{item_id}").
 *
 * Query parameters:
 *   limit  (optional) — max items per page, default 100
 *   cursor (optional) — opaque base64 pagination token
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

        const qs = event.queryStringParameters ?? {};

        const limit = qs.limit ? Math.min(parseInt(qs.limit, 10), 500) : 100;
        if (isNaN(limit) || limit <= 0) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "limit must be a positive integer" }),
            };
        }

        const cursor = qs.cursor ?? undefined;
        const result = await listListingsByItem(item_id, limit, cursor);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                items:  result.items,
                cursor: result.cursor ?? null,
                count:  result.items.length,
            }),
        };
    } catch (error: any) {
        console.error("Error listing shop listings by item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

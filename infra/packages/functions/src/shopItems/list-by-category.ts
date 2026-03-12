import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listActiveByCategory } from "./repo.ts";
import { validateShopItem } from "./validation.ts";

/**
 * GET /shop-items/category/{category}
 *
 * List active ShopItems in a specific category, ordered by required_level → gold_cost → rarity.
 * Only active items are returned (uses GSI1: SHOP#ACTIVE / CATEGORY#{category}#...).
 *
 * Query parameters:
 *   limit  (optional) — max items per page, default 100
 *   cursor (optional) — opaque base64 pagination token
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const category = event.pathParameters?.category;

        if (!category) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing category in path" }),
            };
        }

        // Validate category format (must match the format used when creating items)
        const categoryValidation = validateShopItem({ category });
        if (!categoryValidation.valid) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: categoryValidation.error }),
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

        const result = await listActiveByCategory(category, limit, cursor);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                category,
                items:  result.items,
                cursor: result.cursor ?? null,
                count:  result.items.length,
            }),
        };
    } catch (error: any) {
        console.error("Error listing shop items by category:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

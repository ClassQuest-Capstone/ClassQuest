import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { scanAllItems } from "./repo.ts";

/**
 * GET /shop-items
 *
 * List ALL ShopItems regardless of active/inactive status.
 * Intended for admin/teacher use — uses a table scan.
 *
 * Query parameters:
 *   limit  (optional) — max items per page, default 100
 *   cursor (optional) — opaque base64 pagination token from a previous response
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
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

        const result = await scanAllItems(limit, cursor);

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
        console.error("Error listing all shop items:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

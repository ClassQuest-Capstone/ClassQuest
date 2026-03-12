import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listByGsi1 } from "./repo.ts";
import { buildGsi1Pk } from "./keys.ts";

/**
 * GET /shop-listings/global
 *
 * List global shop listings (no class affiliation).
 * Supports optional `?active_only=true` to filter to manually active listings only.
 *
 * Uses GSI1:
 *   active_only=true  → GSI1PK = "SHOPVIEW#GLOBAL#ACTIVE"
 *   active_only=false → GSI1PK = "SHOPVIEW#GLOBAL#INACTIVE" (+ separate query for ACTIVE)
 *
 * For simplicity, when active_only is not set the handler returns ACTIVE listings only,
 * consistent with the primary display use case. To retrieve inactive listings use active_only=false.
 *
 * Query parameters:
 *   active_only (optional, default "true") — "true" for active only, "false" for inactive only
 *   limit       (optional) — max items per page, default 100
 *   cursor      (optional) — opaque base64 pagination token
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

        const activeOnly = qs.active_only !== "false"; // defaults to true
        const cursor = qs.cursor ?? undefined;
        const gsi1pk = buildGsi1Pk(null, activeOnly);

        const result = await listByGsi1(gsi1pk, limit, cursor);

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
        console.error("Error listing global shop listings:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

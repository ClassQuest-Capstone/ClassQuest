import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listByGsi1 } from "./repo.ts";
import { buildGsi1Pk } from "./keys.ts";

/**
 * GET /shop-listings/active
 *
 * List manually active global shop listings (is_active = true).
 * Uses GSI1 with GSI1PK = "SHOPVIEW#GLOBAL#ACTIVE".
 *
 * Note: this returns listings where is_active=true regardless of the time window.
 * Frontend should additionally filter by available_from/available_to for current visibility.
 *
 * Query parameters:
 *   limit  (optional) — max items per page, default 100
 *   cursor (optional) — opaque base64 pagination token
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
        const gsi1pk = buildGsi1Pk(null, true); // "SHOPVIEW#GLOBAL#ACTIVE"

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
        console.error("Error listing active shop listings:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

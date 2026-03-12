import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listByGsi1 } from "./repo.ts";
import { buildGsi1Pk } from "./keys.ts";

/**
 * GET /shop-listings/class/{class_id}
 *
 * List shop listings for a specific class.
 * Supports optional `?active_only=true` to filter to manually active listings only.
 *
 * Uses GSI1:
 *   active_only=true  → GSI1PK = "SHOPVIEW#CLASS#{class_id}#ACTIVE"
 *   active_only=false → GSI1PK = "SHOPVIEW#CLASS#{class_id}#INACTIVE"
 *
 * Defaults to active_only=true (primary display use case).
 *
 * Query parameters:
 *   active_only (optional, default "true") — "false" to retrieve inactive listings
 *   limit       (optional) — max items per page, default 100
 *   cursor      (optional) — opaque base64 pagination token
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const class_id = event.pathParameters?.class_id;

        if (!class_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing class_id in path" }),
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

        const activeOnly = qs.active_only !== "false"; // defaults to true
        const cursor = qs.cursor ?? undefined;
        const gsi1pk = buildGsi1Pk(class_id, activeOnly);

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
        console.error("Error listing class shop listings:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

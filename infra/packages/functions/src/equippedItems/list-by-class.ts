import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listEquippedItemsByClass } from "./repo.ts";

/**
 * GET /equipped-items/class/{class_id}
 *
 * List all EquippedItems records for a class using GSI1.
 * Supports optional ?limit and ?cursor query parameters for pagination.
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
        const limit  = qs.limit  ? parseInt(qs.limit, 10) : undefined;
        const cursor = qs.cursor ?? undefined;

        const result = await listEquippedItemsByClass(class_id, limit, cursor);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                class_id,
                items: result.items,
                count: result.items.length,
                cursor: result.cursor ?? null,
            }),
        };
    } catch (error: any) {
        console.error("Error listing equipped items by class:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

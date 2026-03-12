import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listByClass } from "./repo.ts";

/**
 * GET /inventory-items/class/{class_id}
 * GET /inventory-items/class/{class_id}/student/{student_id}
 *
 * List inventory items for a class (GSI1).
 * When student_id is present in path params the query is scoped to that student.
 *
 * Query parameters:
 *   limit  (optional) — max items per page, default 100
 *   cursor (optional) — opaque base64 pagination token
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const class_id   = event.pathParameters?.class_id;
        const student_id = event.pathParameters?.student_id; // present only for the filtered route

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

        const cursor = qs.cursor ?? undefined;
        const result = await listByClass(class_id, student_id, limit, cursor);

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
        console.error("Error listing class inventory items:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

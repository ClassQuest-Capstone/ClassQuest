import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listByStudent } from "./repo.ts";

/**
 * GET /inventory-items/student/{student_id}
 *
 * List all inventory items owned by a student.
 * Queries the primary index by PK = STUDENT#{student_id}.
 *
 * Query parameters:
 *   limit  (optional) — max items per page, default 100
 *   cursor (optional) — opaque base64 pagination token
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const student_id = event.pathParameters?.student_id;

        if (!student_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing student_id in path" }),
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
        const result = await listByStudent(student_id, limit, cursor);

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
        console.error("Error listing student inventory items:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

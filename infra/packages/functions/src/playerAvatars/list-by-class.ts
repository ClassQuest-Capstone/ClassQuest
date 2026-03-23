import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listAvatarsByClass } from "./repo.ts";

/**
 * GET /player-avatars/class/{class_id}
 *
 * List all PlayerAvatars in a class.
 * Optional query params: ?limit=N, ?cursor=<base64>
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

        let limit = 100;
        if (qs.limit !== undefined) {
            const parsed = parseInt(qs.limit, 10);
            if (isNaN(parsed) || parsed < 1) {
                return {
                    statusCode: 400,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ error: "limit must be a positive integer" }),
                };
            }
            limit = Math.min(parsed, 500);
        }

        const result = await listAvatarsByClass(class_id, limit, qs.cursor);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                items:    result.items,
                count:    result.items.length,
                cursor:   result.cursor ?? null,
                class_id,
            }),
        };
    } catch (error: any) {
        console.error("Error listing player avatars by class:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

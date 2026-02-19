import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listByOwner } from "./repo.ts";

/**
 * GET /teachers/{teacher_id}/boss-battle-templates
 * List all boss battle templates owned by a teacher
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const teacher_id = event.pathParameters?.teacher_id;

        if (!teacher_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing teacher_id in path" }),
            };
        }

        const items = await listByOwner(teacher_id);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items }),
        };
    } catch (error: any) {
        console.error("Error listing boss battle templates by owner:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: error.message || "Internal server error",
            }),
        };
    }
};

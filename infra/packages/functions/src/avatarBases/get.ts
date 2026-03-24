import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getBase } from "./repo.ts";

/**
 * GET /avatar-bases/{avatar_base_id}
 *
 * Returns a single AvatarBase record by id.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const avatar_base_id = event.pathParameters?.avatar_base_id;

        if (!avatar_base_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing avatar_base_id in path" }),
            };
        }

        const base = await getBase(avatar_base_id);

        if (!base) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Avatar base not found" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(base),
        };
    } catch (error: any) {
        console.error("Error getting avatar base:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

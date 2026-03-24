import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getAvatarByClassAndStudent } from "./repo.ts";

/**
 * GET /player-avatars/class/{class_id}/student/{student_id}
 *
 * Returns the PlayerAvatar for a specific student in a class.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const class_id   = event.pathParameters?.class_id;
        const student_id = event.pathParameters?.student_id;

        if (!class_id || !student_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing class_id or student_id in path" }),
            };
        }

        const avatar = await getAvatarByClassAndStudent(class_id, student_id);

        if (!avatar) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Player avatar not found" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(avatar),
        };
    } catch (error: any) {
        console.error("Error getting player avatar by class+student:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

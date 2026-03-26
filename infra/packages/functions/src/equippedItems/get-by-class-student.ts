import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getEquippedItemsByClassAndStudent } from "./repo.ts";

/**
 * GET /equipped-items/class/{class_id}/student/{student_id}
 *
 * Fetch the EquippedItems record for a specific student in a class via GSI1.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const class_id   = event.pathParameters?.class_id;
        const student_id = event.pathParameters?.student_id;

        if (!class_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing class_id in path" }),
            };
        }

        if (!student_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing student_id in path" }),
            };
        }

        const record = await getEquippedItemsByClassAndStudent(class_id, student_id);

        if (!record) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "EquippedItems record not found for this student in this class" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(record),
        };
    } catch (error: any) {
        console.error("Error fetching equipped items by class+student:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

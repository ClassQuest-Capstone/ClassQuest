import { APIGatewayProxyEventV2 } from "aws-lambda";
import { updateStudentProfile } from "./repo.ts";

export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const student_id = event.pathParameters?.student_id;
        if (!student_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing student_id in path" }),
            };
        }

        const body = JSON.parse(event.body || "{}");

        // Extract only allowed fields
        const updates: { display_name?: string; username?: string } = {};
        if (body.display_name !== undefined) updates.display_name = body.display_name;
        if (body.username !== undefined) updates.username = body.username;

        if (Object.keys(updates).length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "No valid fields to update" }),
            };
        }

        const updated = await updateStudentProfile(student_id, updates);

        if (!updated) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Student profile not found" }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, student_id }),
        };
    } catch (err: any) {
        console.error("Error updating student profile:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || "Internal server error" }),
        };
    }
};

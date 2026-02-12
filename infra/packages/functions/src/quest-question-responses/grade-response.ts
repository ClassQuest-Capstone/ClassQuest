import { gradeResponse } from "./repo.js";

export const handler = async (event: any) => {
    const quest_instance_id = event.pathParameters?.quest_instance_id;
    const question_id = event.pathParameters?.question_id;
    const student_id = event.pathParameters?.student_id;

    if (!quest_instance_id || !question_id || !student_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "Missing required path parameters: quest_instance_id, question_id, student_id"
            }),
        };
    }

    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : (rawBody ?? {});

    // Validate numeric fields >= 0
    if (body.teacher_points_awarded !== undefined) {
        if (typeof body.teacher_points_awarded !== "number" || body.teacher_points_awarded < 0) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "teacher_points_awarded must be a number >= 0" }),
            };
        }
    }

    const patch: {
        teacher_points_awarded?: number;
        teacher_comment?: string;
        graded_by_teacher_id?: string;
    } = {};

    if (body.teacher_points_awarded !== undefined) {
        patch.teacher_points_awarded = body.teacher_points_awarded;
    }

    if (body.teacher_comment !== undefined) {
        patch.teacher_comment = body.teacher_comment;
    }

    if (body.graded_by_teacher_id !== undefined) {
        patch.graded_by_teacher_id = body.graded_by_teacher_id;
    }

    try {
        await gradeResponse(quest_instance_id, student_id, question_id, patch);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ok: true,
                graded_at: new Date().toISOString()
            }),
        };
    } catch (error: any) {
        console.error("Error grading response:", error);

        // Check if the response doesn't exist
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Response not found" }),
            };
        }

        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "Internal server error" }),
        };
    }
};

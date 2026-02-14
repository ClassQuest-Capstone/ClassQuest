import { getMembership } from "./repo.js";

export const handler = async (event: any) => {
    try {
        const class_id = event.pathParameters?.class_id;
        const student_id = event.pathParameters?.student_id;

        if (!class_id || !student_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required path parameters: class_id, student_id",
                }),
            };
        }

        const membership = await getMembership(class_id, student_id);

        if (!membership) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Membership not found",
                }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(membership),
        };
    } catch (err: any) {
        console.error("Error getting membership:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "Internal server error",
                message: err.message,
            }),
        };
    }
};

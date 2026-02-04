import { dropEnrollment } from "./repo.ts";

/**
 * DELETE /enrollments/{enrollment_id}
 * Student drops a class (soft delete)
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify student owns this enrollment or teacher owns the class

    const enrollment_id = event.pathParameters?.enrollment_id;

    if (!enrollment_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_ENROLLMENT_ID" }),
        };
    }

    try {
        await dropEnrollment(enrollment_id);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                message: "Successfully dropped class",
                enrollment_id,
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "ENROLLMENT_NOT_FOUND" }),
            };
        }

        console.error("Error dropping enrollment:", error);
        throw error;
    }
};

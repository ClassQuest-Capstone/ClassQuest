import { getEnrollment } from "./repo.ts";

/**
 * GET /enrollments/{enrollment_id}
 * Get a single enrollment record
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify student owns enrollment or teacher owns class

    const enrollment_id = event.pathParameters?.enrollment_id;

    if (!enrollment_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_ENROLLMENT_ID" }),
        };
    }

    const item = await getEnrollment(enrollment_id);

    return {
        statusCode: item ? 200 : 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item ?? { error: "ENROLLMENT_NOT_FOUND" }),
    };
};

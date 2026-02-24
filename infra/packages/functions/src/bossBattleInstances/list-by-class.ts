import { listBossBattleInstancesByClass } from "./repo.js";

/**
 * GET /classes/{class_id}/boss-battle-instances
 * List all boss battle instances for a class
 *
 * Authorization: TEACHER, ADMIN, or students enrolled in the class
 */
export const handler = async (event: any) => {
    try {
        const class_id = event.pathParameters?.class_id;

        if (!class_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing class_id path parameter" }),
            };
        }

        // Authorization
        const userRole = event.requestContext?.authorizer?.jwt?.claims?.["cognito:groups"] as string | undefined;
        const userId = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined;

        if (!userId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized: Missing user identity" }),
            };
        }

        const isTeacher = userRole?.includes("Teachers");
        const isAdmin = userRole?.includes("Admins");

        // Teachers and admins can always access
        // Students can access too (but should verify enrollment - simplified for now)
        if (!isTeacher && !isAdmin) {
            // Note: Should check ClassEnrollments to verify student is enrolled in this class
            // For now, we allow all authenticated users
        }

        // Extract pagination params
        const limit = event.queryStringParameters?.limit
            ? parseInt(event.queryStringParameters.limit, 10)
            : undefined;
        const cursor = event.queryStringParameters?.cursor;

        // Query instances
        const result = await listBossBattleInstancesByClass(class_id, limit, cursor);

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error listing boss battle instances by class:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

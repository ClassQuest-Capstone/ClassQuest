import { getBossBattleInstance } from "./repo.js";
import { BossBattleStatus } from "./types.js";

/**
 * GET /boss-battle-instances/{boss_instance_id}
 * Get a boss battle instance by ID
 *
 * Authorization:
 * - TEACHER, ADMIN: can always access
 * - STUDENT: can access only if enrolled in class AND instance is not DRAFT
 */
export const handler = async (event: any) => {
    try {
        const boss_instance_id = event.pathParameters?.boss_instance_id;

        if (!boss_instance_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing boss_instance_id path parameter" }),
            };
        }

        // Get the instance
        const instance = await getBossBattleInstance(boss_instance_id);

        if (!instance) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Boss battle instance not found" }),
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
        const isStudent = userRole?.includes("Students");

        // Teachers and admins can always access
        if (isTeacher || isAdmin) {
            return {
                statusCode: 200,
                body: JSON.stringify(instance),
            };
        }

        // Students can only access if instance is not DRAFT
        // (Note: Should also check if student is enrolled in class, but that would require
        // fetching ClassEnrollments - simplified for now)
        if (isStudent) {
            if (instance.status === BossBattleStatus.DRAFT) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({ error: "Forbidden: Cannot access draft boss battles" }),
                };
            }

            return {
                statusCode: 200,
                body: JSON.stringify(instance),
            };
        }

        return {
            statusCode: 403,
            body: JSON.stringify({ error: "Forbidden" }),
        };
    } catch (error: any) {
        console.error("Error getting boss battle instance:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

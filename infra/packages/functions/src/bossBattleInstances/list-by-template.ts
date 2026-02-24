import { listBossBattleInstancesByTemplate } from "./repo.js";

/**
 * GET /boss-battle-templates/{boss_template_id}/boss-battle-instances
 * List all boss battle instances for a template
 *
 * Authorization: TEACHER, ADMIN only (for analytics/template usage tracking)
 */
export const handler = async (event: any) => {
    try {
        const boss_template_id = event.pathParameters?.boss_template_id;

        if (!boss_template_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing boss_template_id path parameter" }),
            };
        }

        // Authorization: Only teachers and admins
        const userRole = event.requestContext?.authorizer?.jwt?.claims?.["cognito:groups"] as string | undefined;
        const userId = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined;

        if (!userId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized: Missing user identity" }),
            };
        }

        const allowedRoles = ["Teachers", "Admins"];
        const hasPermission = userRole?.split(",").some(role => allowedRoles.includes(role.trim()));

        if (!hasPermission) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Forbidden: Only teachers and admins can list instances by template" }),
            };
        }

        // Extract pagination params
        const limit = event.queryStringParameters?.limit
            ? parseInt(event.queryStringParameters.limit, 10)
            : undefined;
        const cursor = event.queryStringParameters?.cursor;

        // Query instances
        const result = await listBossBattleInstancesByTemplate(boss_template_id, limit, cursor);

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (error: any) {
        console.error("Error listing boss battle instances by template:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

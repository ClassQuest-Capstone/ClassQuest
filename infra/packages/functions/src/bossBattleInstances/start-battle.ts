import { getBossBattleInstance, startBossBattleInstance } from "./repo.js";
import { BossBattleStatus } from "./types.js";
import { getTemplate as getBossTemplate } from "../bossBattleTemplates/repo.js";

/**
 * POST /boss-battle-instances/{boss_instance_id}/start
 *
 * StartBattle — dedicated lifecycle API for opening the battle lobby.
 * Transitions the instance from DRAFT -> LOBBY and sets lobby_opened_at.
 *
 * Use this endpoint instead of the generic PATCH for the DRAFT -> LOBBY
 * transition; it enforces all business rules and uses a conditional write
 * so concurrent duplicate calls cannot both succeed.
 *
 * Authorization: TEACHER or ADMIN only.
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

        // Authorization: Only teachers and admins can start boss battles
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

        if (!isTeacher && !isAdmin) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Only teachers can start boss battles" }),
            };
        }

        // Load the instance
        const instance = await getBossBattleInstance(boss_instance_id);

        if (!instance) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Boss battle instance not found" }),
            };
        }

        // Validate current status is exactly DRAFT
        if (instance.status !== BossBattleStatus.DRAFT) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Boss battle can only be started from DRAFT state",
                    current_status: instance.status,
                }),
            };
        }

        // Validate the referenced template exists and is not soft-deleted
        const template = await getBossTemplate(instance.boss_template_id);

        if (!template) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "Cannot start battle from a deleted template" }),
            };
        }

        // Perform the conditional DRAFT -> LOBBY transition
        const now = new Date().toISOString();
        const updated = await startBossBattleInstance(boss_instance_id, now, now);

        return {
            statusCode: 200,
            body: JSON.stringify(updated),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            // A concurrent call already transitioned the instance away from DRAFT
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Boss battle can only be started from DRAFT state",
                }),
            };
        }

        console.error("Error starting boss battle:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

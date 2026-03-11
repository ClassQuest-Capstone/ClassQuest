import { getBossBattleInstance, finishBattle as finishBattleRepo } from "./repo.js";
import { BossBattleStatus } from "./types.js";
import { listParticipants } from "../bossBattleParticipants/repo.js";
import { ParticipantState } from "../bossBattleParticipants/types.js";
import { computeAndWriteBossResults } from "../bossResults/repo.js";

/**
 * Finishable entry states.
 * TODO: extend to QUESTION_ACTIVE if teacher abort from mid-question is needed.
 */
const FINISHABLE_STATUSES = new Set<string>([
    BossBattleStatus.INTERMISSION,
    BossBattleStatus.RESOLVING,
]);

/**
 * POST /boss-battle-instances/{boss_instance_id}/finish
 *
 * FinishBattle finalizes a boss battle, writes BossResults, and transitions
 * the instance to COMPLETED. This is the final orchestration step.
 *
 * It does NOT accept student answers or resolve an active question.
 * Those belong to SubmitBossAnswer and ResolveQuestion.
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

        // Authorization: Only teachers and admins can finish a battle
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
                body: JSON.stringify({ error: "Only teachers can finish a battle" }),
            };
        }

        // --- 1. Load and validate instance ---
        const instance = await getBossBattleInstance(boss_instance_id);

        if (!instance) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Boss battle instance not found" }),
            };
        }

        if (instance.status === BossBattleStatus.COMPLETED) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "Battle is already COMPLETED" }),
            };
        }

        if (instance.status === BossBattleStatus.ABORTED) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "Battle is ABORTED and cannot be finished" }),
            };
        }

        if (!FINISHABLE_STATUSES.has(instance.status)) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Battle is not in a finishable state",
                    current_status: instance.status,
                    allowed_states: ["INTERMISSION", "RESOLVING"],
                }),
            };
        }

        // --- 2. Determine final outcome ---
        let outcome: "WIN" | "FAIL";
        let fail_reason: "ALL_GUILDS_DOWN" | "OUT_OF_QUESTIONS" | "ABORTED_BY_TEACHER" | undefined;

        if (instance.current_boss_hp === 0) {
            // Boss HP depleted — battle is won
            outcome = "WIN";
        } else {
            // Check whether all JOINED guilds are fully downed
            const joinedParticipants = await listParticipants(boss_instance_id, {
                state: ParticipantState.JOINED,
            });

            // Build per-guild downed status: true when every member in the guild is downed
            const guildDownedMap = new Map<string, boolean>();
            for (const p of joinedParticipants) {
                if (!p.guild_id) continue;
                if (!guildDownedMap.has(p.guild_id)) guildDownedMap.set(p.guild_id, true);
                if (!p.is_downed) guildDownedMap.set(p.guild_id, false);
            }

            const allGuildsDown =
                guildDownedMap.size > 0 &&
                [...guildDownedMap.values()].every((v) => v);

            if (allGuildsDown) {
                outcome = "FAIL";
                fail_reason = "ALL_GUILDS_DOWN";
            } else {
                // TODO: support ABORTED_BY_TEACHER when caller explicitly provides a reason
                return {
                    statusCode: 409,
                    body: JSON.stringify({
                        error: "Battle is not ready to be finished — boss is alive and not all guilds are down",
                    }),
                };
            }
        }

        // --- 3. Conditionally transition instance to COMPLETED ---
        const now = new Date().toISOString();
        let updatedInstance;
        try {
            updatedInstance = await finishBattleRepo(boss_instance_id, {
                outcome,
                fail_reason,
                completed_at: now,
                updated_at: now,
            });
        } catch (err: any) {
            if (err?.name === "ConditionalCheckFailedException") {
                return {
                    statusCode: 409,
                    body: JSON.stringify({
                        error: "Already finished — battle is no longer in a finishable state",
                    }),
                };
            }
            throw err;
        }

        // --- 4. Write BossResults (instance is now COMPLETED) ---
        const resultsOutcome = await computeAndWriteBossResults(
            boss_instance_id,
            "finish-battle"
        );

        return {
            statusCode: 200,
            body: JSON.stringify({
                boss_instance_id,
                status: updatedInstance.status,
                outcome: updatedInstance.outcome ?? null,
                fail_reason: updatedInstance.fail_reason ?? null,
                completed_at: updatedInstance.completed_at ?? now,
                results_written: resultsOutcome.success,
            }),
        };
    } catch (error: any) {
        console.error("Error finishing boss battle:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

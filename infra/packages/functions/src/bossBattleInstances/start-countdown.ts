import { getBossBattleInstance, startBossBattleCountdown } from "./repo.js";
import { BossBattleStatus, ModeType } from "./types.js";
import { getTemplate as getBossTemplate } from "../bossBattleTemplates/repo.js";
import { listParticipants } from "../bossBattleParticipants/repo.js";
import { ParticipantState } from "../bossBattleParticipants/types.js";
import { createParticipantsSnapshot } from "../bossBattleSnapshots/repo.js";
import { createQuestionPlanForInstance } from "../bossBattleQuestionPlans/repo.js";

const DEFAULT_COUNTDOWN_SECONDS = 10;

/**
 * POST /boss-battle-instances/{boss_instance_id}/countdown
 *
 * StartCountdown — dedicated lifecycle API for freezing the lobby into
 * deterministic runtime state.
 *
 * This endpoint must be used instead of the generic PATCH for the
 * LOBBY -> COUNTDOWN transition. It orchestrates:
 *   1. Participant validation (at least one JOINED)
 *   2. Immutable participants snapshot creation
 *   3. Deterministic question plan generation (per-guild if RANDOMIZED_PER_GUILD)
 *   4. Atomic conditional update: status LOBBY -> COUNTDOWN + countdown_end_at
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

        // Authorization: Only teachers and admins can start countdown
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
                body: JSON.stringify({ error: "Only teachers can start countdown" }),
            };
        }

        // --- 1. Load instance ---
        const instance = await getBossBattleInstance(boss_instance_id);

        if (!instance) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Boss battle instance not found" }),
            };
        }

        // --- 2. Validate current status ---
        if (instance.status !== BossBattleStatus.LOBBY) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Boss battle countdown can only start from LOBBY state",
                    current_status: instance.status,
                }),
            };
        }

        // --- 3. Validate template exists and is not soft-deleted ---
        const template = await getBossTemplate(instance.boss_template_id);

        if (!template) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "Cannot start countdown from a deleted template" }),
            };
        }

        // --- 4. Validate joined participants ---
        const joinedParticipants = await listParticipants(boss_instance_id, {
            state: ParticipantState.JOINED,
        });

        if (joinedParticipants.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "At least one joined participant is required" }),
            };
        }

        // For RANDOMIZED_PER_GUILD: require at least one guild in the participant set
        if (instance.mode_type === ModeType.RANDOMIZED_PER_GUILD) {
            const uniqueGuilds = new Set(joinedParticipants.map((p) => p.guild_id));
            if (uniqueGuilds.size === 0) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        error: "At least one joined participant is required",
                        detail: "No guilds found in joined participant set",
                    }),
                };
            }
        }

        // --- 5. Create participants snapshot ---
        // The snapshot repo queries JOINED participants internally and writes
        // participants_snapshot_id onto the instance.
        await createParticipantsSnapshot({
            boss_instance_id,
            created_by_teacher_id: instance.created_by_teacher_id,
        });

        // --- 6. Create question plan ---
        // The question plan repo loads questions by template, generates the
        // deterministic order (per-guild if RANDOMIZED_PER_GUILD), and writes
        // question_plan_id (and per_guild_question_index) onto the instance.
        try {
            await createQuestionPlanForInstance({
                boss_instance_id,
                created_by_teacher_id: instance.created_by_teacher_id,
            });
        } catch (err: any) {
            if (err.message?.includes("No questions found")) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: "No boss questions found for template" }),
                };
            }
            if (err.message?.includes("Question plan already")) {
                return {
                    statusCode: 409,
                    body: JSON.stringify({ error: "Question plan already initialized for this battle" }),
                };
            }
            throw err;
        }

        // --- 7. Atomic LOBBY -> COUNTDOWN transition ---
        const effectiveCountdownSeconds =
            instance.countdown_seconds ?? DEFAULT_COUNTDOWN_SECONDS;
        const now = new Date();
        const nowIso = now.toISOString();
        const countdownEndAt = new Date(
            now.getTime() + effectiveCountdownSeconds * 1000
        ).toISOString();

        const updated = await startBossBattleCountdown(
            boss_instance_id,
            countdownEndAt,
            nowIso
        );

        return {
            statusCode: 200,
            body: JSON.stringify(updated),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            // A concurrent call already moved the instance away from LOBBY
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Boss battle countdown can only start from LOBBY state",
                }),
            };
        }

        console.error("Error starting boss battle countdown:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

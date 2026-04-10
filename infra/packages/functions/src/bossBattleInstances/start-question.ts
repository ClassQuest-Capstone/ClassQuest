import { getBossBattleInstance, startBossBattleQuestion } from "./repo.js";
import { BossBattleStatus, ModeType } from "./types.js";
import { getTemplate as getBossTemplate } from "../bossBattleTemplates/repo.js";
import { getQuestionPlan } from "../bossBattleQuestionPlans/repo.js";
import { getQuestion } from "../bossQuestions/repo.js";
import { listParticipants } from "../bossBattleParticipants/repo.js";
import { ParticipantState } from "../bossBattleParticipants/types.js";
import type {
    BossBattleQuestionPlanGlobal,
    BossBattleQuestionPlanPerGuild,
} from "../bossBattleQuestionPlans/types.js";

/**
 * POST /boss-battle-instances/{boss_instance_id}/start-question
 *
 * StartQuestion — lifecycle API that activates the current planned question
 * and initializes runtime timing state.
 *
 * Allowed entry states: COUNTDOWN, INTERMISSION.
 * current_question_index is NOT incremented here; that happens in Resolve/NextQuestion.
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

        // Authorization: Only teachers and admins can start a question
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
                body: JSON.stringify({ error: "Only teachers can start a question" }),
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

        // --- 2. Validate entry status ---
        const allowedStatuses: string[] = [
            BossBattleStatus.COUNTDOWN,
            BossBattleStatus.INTERMISSION,
        ];

        if (!allowedStatuses.includes(instance.status)) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "StartQuestion is only allowed from COUNTDOWN or INTERMISSION state",
                    current_status: instance.status,
                }),
            };
        }

        // --- 3. Validate template ---
        const template = await getBossTemplate(instance.boss_template_id);

        if (!template) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "Cannot start question from a deleted template" }),
            };
        }

        // --- 4. Resolve active question based on mode ---
        let active_question_id: string;
        let active_guild_id: string | undefined;

        if (
            instance.mode_type === ModeType.SIMULTANEOUS_ALL ||
            instance.mode_type === ModeType.TURN_BASED_GUILD
        ) {
            // Load global question plan
            if (!instance.question_plan_id) {
                return {
                    statusCode: 409,
                    body: JSON.stringify({ error: "No question plan found for this battle" }),
                };
            }

            const plan = await getQuestionPlan(instance.question_plan_id);

            if (!plan) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: "Question plan not found" }),
                };
            }

            const globalPlan = plan as BossBattleQuestionPlanGlobal;
            const idx = instance.current_question_index ?? 0;

            if (!globalPlan.question_ids || idx >= globalPlan.question_ids.length) {
                return {
                    statusCode: 409,
                    body: JSON.stringify({ error: "No remaining questions in plan" }),
                };
            }

            active_question_id = globalPlan.question_ids[idx];

            if (instance.mode_type === ModeType.TURN_BASED_GUILD) {
                // TODO: implement full guild turn rotation policy (ROUND_ROBIN / RANDOM_NEXT_GUILD / TEACHER_SELECTS_NEXT)
                // For now, keep existing active_guild_id if set; rotation policy is a future concern.
                active_guild_id = instance.active_guild_id ?? undefined;

                if (!active_guild_id) {
                    return {
                        statusCode: 409,
                        body: JSON.stringify({
                            error: "No active guild set for TURN_BASED_GUILD mode",
                        }),
                    };
                }
            }
        } else {
            // RANDOMIZED_PER_GUILD
            if (!instance.guild_question_plan_id) {
                return {
                    statusCode: 409,
                    body: JSON.stringify({ error: "No guild question plan found for this battle" }),
                };
            }

            const plan = await getQuestionPlan(instance.guild_question_plan_id);

            if (!plan) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: "Guild question plan not found" }),
                };
            }

            const perGuildPlan = plan as BossBattleQuestionPlanPerGuild;

            if (
                !instance.per_guild_question_index ||
                Object.keys(instance.per_guild_question_index).length === 0
            ) {
                return {
                    statusCode: 409,
                    body: JSON.stringify({
                        error: "No per-guild question index found for this battle",
                    }),
                };
            }

            // TODO: RANDOMIZED_PER_GUILD should eventually resolve active questions per guild
            // instead of one global active_question_id. Using the first guild deterministically
            // for schema compatibility until per-guild active question resolution is built.
            const firstGuildId = Object.keys(instance.per_guild_question_index).sort()[0];
            const guildIdx = instance.per_guild_question_index[firstGuildId] ?? 0;
            const guildQIds = perGuildPlan.guild_question_ids?.[firstGuildId];

            if (!guildQIds || guildIdx >= guildQIds.length) {
                return {
                    statusCode: 409,
                    body: JSON.stringify({ error: "No remaining questions in guild plan" }),
                };
            }

            active_question_id = guildQIds[guildIdx];
        }

        // --- 4b. Compute answer-gating quorum state for the new question ---
        // Load all JOINED non-downed participants for scope relevant to this mode.
        const allJoined = await listParticipants(boss_instance_id, {
            state: ParticipantState.JOINED,
        });
        // Exclude downed students from quorum — they cannot block question advancement
        const activeParticipants = allJoined.filter(p => !p.is_downed);

        let required_answer_count: number;
        let ready_to_resolve_init: boolean;
        let per_guild_required: Record<string, number> | undefined;
        let per_guild_received: Record<string, number> | undefined;
        let per_guild_ready: Record<string, boolean> | undefined;

        if (instance.mode_type === ModeType.SIMULTANEOUS_ALL) {
            required_answer_count = activeParticipants.length;
            ready_to_resolve_init = required_answer_count === 0;
        } else if (instance.mode_type === ModeType.TURN_BASED_GUILD) {
            // Only count participants in the active guild
            const guildParticipants = activeParticipants.filter(
                (p) => p.guild_id === active_guild_id
            );
            required_answer_count = guildParticipants.length;
            ready_to_resolve_init = required_answer_count === 0;
        } else {
            // RANDOMIZED_PER_GUILD: build per-guild counts
            // TODO: RANDOMIZED_PER_GUILD should fully support independent per-guild question readiness tracking
            const guildCountMap: Record<string, number> = {};
            for (const p of activeParticipants) {
                if (!p.guild_id) continue;
                guildCountMap[p.guild_id] = (guildCountMap[p.guild_id] ?? 0) + 1;
            }
            per_guild_required = guildCountMap;
            per_guild_received = Object.fromEntries(
                Object.keys(guildCountMap).map((gid) => [gid, 0])
            );
            per_guild_ready = Object.fromEntries(
                Object.keys(guildCountMap).map((gid) => [gid, guildCountMap[gid] === 0])
            );
            // Global required = sum of all guild counts for overall tracking
            required_answer_count = Object.values(guildCountMap).reduce((s, v) => s + v, 0);
            ready_to_resolve_init = required_answer_count === 0;
        }

        // --- 5. Load BossQuestion and compute timing ---
        const question = await getQuestion(active_question_id);

        if (!question) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Boss question not found" }),
            };
        }

        const now = new Date();
        const nowIso = now.toISOString();
        const effectiveTimeLimit =
            question.time_limit_seconds ?? instance.time_limit_seconds_default ?? null;

        const question_ends_at =
            effectiveTimeLimit !== null
                ? new Date(now.getTime() + effectiveTimeLimit * 1000).toISOString()
                : null;

        // --- 6. Atomic conditional update ---
        const updated = await startBossBattleQuestion(boss_instance_id, {
            active_question_id,
            active_guild_id,
            question_started_at: nowIso,
            question_ends_at,
            updated_at: nowIso,
            required_answer_count,
            received_answer_count: 0,
            ready_to_resolve: ready_to_resolve_init,
            per_guild_required_answer_count: per_guild_required,
            per_guild_received_answer_count: per_guild_received,
            per_guild_ready_to_resolve: per_guild_ready,
        });

        return {
            statusCode: 200,
            body: JSON.stringify(updated),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "StartQuestion is only allowed from COUNTDOWN or INTERMISSION state",
                }),
            };
        }

        console.error("Error starting boss battle question:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

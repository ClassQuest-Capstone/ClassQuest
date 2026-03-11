import { getBossBattleInstance, advanceToNextQuestion as advanceToNextQuestionRepo } from "./repo.js";
import { BossBattleStatus, ModeType } from "./types.js";
import type { BossBattleInstanceItem } from "./types.js";
import { getQuestionPlan } from "../bossBattleQuestionPlans/repo.js";
import type {
    BossBattleQuestionPlanGlobal,
    BossBattleQuestionPlanPerGuild,
} from "../bossBattleQuestionPlans/types.js";

/**
 * POST /boss-battle-instances/{boss_instance_id}/advance-question
 *
 * AdvanceToNextQuestion — advances battle question indexes after a question has
 * been resolved. If no questions remain and the boss is still alive, the battle
 * ends as FAIL with OUT_OF_QUESTIONS.
 *
 * This is a pure orchestration step — it does NOT apply damage, penalties,
 * or grade submissions. Those belong to SubmitBossAnswer and ResolveQuestion.
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

        // Authorization: Only teachers and admins can advance to the next question
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
                body: JSON.stringify({ error: "Only teachers can advance to the next question" }),
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

        if (instance.status !== BossBattleStatus.INTERMISSION) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "AdvanceToNextQuestion can only run during INTERMISSION",
                    current_status: instance.status,
                }),
            };
        }

        // Boss already dead — ResolveQuestion should have completed the battle
        if (instance.current_boss_hp === 0) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Battle already won; cannot advance to next question",
                }),
            };
        }

        const now = new Date().toISOString();

        // --- 2. Mode-specific plan load and index advancement ---
        if (instance.mode_type === ModeType.RANDOMIZED_PER_GUILD) {
            return await advanceRandomizedPerGuild(instance, boss_instance_id, now);
        }

        // SIMULTANEOUS_ALL and TURN_BASED_GUILD: global question plan
        // TODO: implement full guild turn rotation policy here or in StartQuestion (TURN_BASED_GUILD)
        return await advanceGlobalPlan(instance, boss_instance_id, now);

    } catch (error: any) {
        console.error("Error advancing boss battle to next question:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

// ---------------------------------------------------------------------------
// Global plan advancement (SIMULTANEOUS_ALL + TURN_BASED_GUILD)
// ---------------------------------------------------------------------------

async function advanceGlobalPlan(
    instance: BossBattleInstanceItem,
    boss_instance_id: string,
    now: string
) {
    const planId = instance.question_plan_id;
    if (!planId) {
        return {
            statusCode: 409,
            body: JSON.stringify({ error: "No question_plan_id on instance" }),
        };
    }

    const plan = (await getQuestionPlan(planId)) as BossBattleQuestionPlanGlobal | null;
    if (!plan || !plan.question_ids) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: "Question plan not found" }),
        };
    }

    const next_index = (instance.current_question_index ?? 0) + 1;
    const has_more = next_index < plan.question_ids.length;

    const next_status: "INTERMISSION" | "COMPLETED" = has_more ? "INTERMISSION" : "COMPLETED";
    const outcome = has_more ? undefined : ("FAIL" as const);
    const fail_reason = has_more ? undefined : ("OUT_OF_QUESTIONS" as const);
    const completed_at = has_more ? undefined : now;

    return await doConditionalUpdate(boss_instance_id, now, {
        next_question_index: next_index,
        next_status,
        outcome,
        fail_reason,
        completed_at,
        has_more,
    });
}

// ---------------------------------------------------------------------------
// Per-guild plan advancement (RANDOMIZED_PER_GUILD)
// ---------------------------------------------------------------------------

async function advanceRandomizedPerGuild(
    instance: BossBattleInstanceItem,
    boss_instance_id: string,
    now: string
) {
    // TODO: RANDOMIZED_PER_GUILD should eventually advance guild indexes independently
    // rather than through a single shared progression endpoint. Currently all guild
    // indexes are advanced together since there is no per-guild activation context
    // available at this endpoint.
    const planId = instance.guild_question_plan_id;
    if (!planId) {
        return {
            statusCode: 409,
            body: JSON.stringify({ error: "No guild_question_plan_id on instance" }),
        };
    }

    const plan = (await getQuestionPlan(planId)) as BossBattleQuestionPlanPerGuild | null;
    if (!plan || !plan.guild_question_ids) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: "Guild question plan not found" }),
        };
    }

    const guildIds = Object.keys(plan.guild_question_ids);
    if (guildIds.length === 0) {
        return {
            statusCode: 409,
            body: JSON.stringify({ error: "No guilds in plan" }),
        };
    }

    // Advance all guild indexes by 1
    const next_per_guild: Record<string, number> = {};
    for (const gid of guildIds) {
        next_per_guild[gid] = (instance.per_guild_question_index?.[gid] ?? 0) + 1;
    }

    // All guilds share the same question count; use the first to determine remaining
    const firstGuild = guildIds[0];
    const totalQuestions =
        plan.guild_question_count[firstGuild] ??
        plan.guild_question_ids[firstGuild].length;
    const has_more = next_per_guild[firstGuild] < totalQuestions;

    const next_status: "INTERMISSION" | "COMPLETED" = has_more ? "INTERMISSION" : "COMPLETED";
    const outcome = has_more ? undefined : ("FAIL" as const);
    const fail_reason = has_more ? undefined : ("OUT_OF_QUESTIONS" as const);
    const completed_at = has_more ? undefined : now;

    return await doConditionalUpdate(boss_instance_id, now, {
        next_per_guild_question_index: next_per_guild,
        next_status,
        outcome,
        fail_reason,
        completed_at,
        has_more,
    });
}

// ---------------------------------------------------------------------------
// Shared: perform the conditional DynamoDB update and format response
// ---------------------------------------------------------------------------

async function doConditionalUpdate(
    boss_instance_id: string,
    now: string,
    opts: {
        next_question_index?: number;
        next_per_guild_question_index?: Record<string, number>;
        next_status: "INTERMISSION" | "COMPLETED";
        outcome?: "FAIL";
        fail_reason?: "OUT_OF_QUESTIONS";
        completed_at?: string;
        has_more: boolean;
    }
) {
    let updatedInstance: BossBattleInstanceItem;
    try {
        updatedInstance = await advanceToNextQuestionRepo(boss_instance_id, {
            next_question_index: opts.next_question_index,
            next_per_guild_question_index: opts.next_per_guild_question_index,
            next_status: opts.next_status,
            outcome: opts.outcome,
            fail_reason: opts.fail_reason,
            completed_at: opts.completed_at,
            updated_at: now,
        });
    } catch (err: any) {
        if (err?.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "Already advanced — battle is no longer in INTERMISSION",
                }),
            };
        }
        throw err;
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            boss_instance_id,
            status: updatedInstance.status,
            current_question_index: updatedInstance.current_question_index,
            per_guild_question_index: updatedInstance.per_guild_question_index ?? null,
            outcome: updatedInstance.outcome ?? null,
            fail_reason: updatedInstance.fail_reason ?? null,
            has_more_questions: opts.has_more,
        }),
    };
}

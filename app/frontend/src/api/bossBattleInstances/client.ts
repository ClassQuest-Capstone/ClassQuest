import { api } from "../http.js";
import type {
    BossBattleInstance,
    CreateBossBattleInstanceInput,
    UpdateBossBattleInstanceInput,
    PaginatedBossBattleInstances,
    SubmitBossAnswerPayload,
    SubmitBossAnswerResponse,
    ResolveQuestionResponse,
    AdvanceQuestionResponse,
    FinishBattleResponse,
} from "./types.js";

/**
 * Create a new boss battle instance
 * POST /boss-battle-instances
 */
export function createBossBattleInstance(input: CreateBossBattleInstanceInput) {
    return api<{
        message: string;
        boss_instance_id: string;
        status: string;
    }>("/boss-battle-instances", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/**
 * Get a boss battle instance by ID
 * GET /boss-battle-instances/{boss_instance_id}
 */
export function getBossBattleInstance(bossInstanceId: string) {
    return api<BossBattleInstance>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}`
    );
}

/**
 * List boss battle instances by class
 * GET /classes/{class_id}/boss-battle-instances
 */
export function listBossBattleInstancesByClass(
    classId: string,
    options?: {
        limit?: number;
        cursor?: string;
    }
) {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedBossBattleInstances>(
        `/classes/${encodeURIComponent(classId)}/boss-battle-instances${qs ? `?${qs}` : ""}`
    );
}

/**
 * List boss battle instances by template
 * GET /boss-battle-templates/{boss_template_id}/boss-battle-instances
 */
export function listBossBattleInstancesByTemplate(
    bossTemplateId: string,
    options?: {
        limit?: number;
        cursor?: string;
    }
) {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedBossBattleInstances>(
        `/boss-battle-templates/${encodeURIComponent(bossTemplateId)}/boss-battle-instances${qs ? `?${qs}` : ""}`
    );
}

/**
 * Update a boss battle instance
 * PATCH /boss-battle-instances/{boss_instance_id}
 */
export function updateBossBattleInstance(
    bossInstanceId: string,
    updates: UpdateBossBattleInstanceInput
) {
    return api<{
        message: string;
        boss_instance_id: string;
        updated_at: string;
    }>(`/boss-battle-instances/${encodeURIComponent(bossInstanceId)}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
    });
}

/**
 * Open the battle lobby — transitions status from DRAFT to LOBBY.
 * POST /boss-battle-instances/{boss_instance_id}/start
 *
 * Use this instead of the generic PATCH for the DRAFT -> LOBBY lifecycle step.
 */
export function startBossBattleInstance(bossInstanceId: string) {
    return api<BossBattleInstance>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/start`,
        { method: "POST" }
    );
}

/**
 * Freeze the lobby and start the countdown — transitions status from LOBBY to COUNTDOWN.
 * POST /boss-battle-instances/{boss_instance_id}/countdown
 *
 * Snapshots JOINED participants, generates the deterministic question plan, and
 * sets countdown_end_at. Use this instead of the generic PATCH for the
 * LOBBY -> COUNTDOWN lifecycle step.
 */
export function startBossBattleCountdown(bossInstanceId: string) {
    return api<BossBattleInstance>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/countdown`,
        { method: "POST" }
    );
}

/**
 * Activate the current planned question — transitions status to QUESTION_ACTIVE.
 * POST /boss-battle-instances/{boss_instance_id}/start-question
 *
 * Allowed from COUNTDOWN or INTERMISSION. Sets active_question_id, question_started_at,
 * and question_ends_at (if timed). Use this instead of the generic PATCH for the
 * COUNTDOWN/INTERMISSION -> QUESTION_ACTIVE lifecycle step.
 */
export function startBossBattleQuestion(bossInstanceId: string) {
    return api<BossBattleInstance>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/start-question`,
        { method: "POST" }
    );
}

/**
 * Submit a student answer during QUESTION_ACTIVE.
 * POST /boss-battle-instances/{boss_instance_id}/submit-answer
 *
 * TODO: derive student_id from authenticated token instead of request body
 */
/**
 * Resolve the active question — applies damage, penalties, and transitions battle state.
 * POST /boss-battle-instances/{boss_instance_id}/resolve-question
 *
 * Teacher/admin only.
 * TODO: restrict this endpoint to teacher/admin users
 */
/**
 * Advance to the next question after a question has been resolved.
 * POST /boss-battle-instances/{boss_instance_id}/advance-question
 *
 * Teacher/admin only.
 * TODO: restrict this endpoint to teacher/admin users
 */
export function advanceBossBattleToNextQuestion(bossInstanceId: string) {
    return api<AdvanceQuestionResponse>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/advance-question`,
        { method: "POST" }
    );
}

export function resolveBossBattleQuestion(bossInstanceId: string, options?: { force?: boolean }) {
    return api<ResolveQuestionResponse>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/resolve-question`,
        {
            method: "POST",
            body: options?.force ? JSON.stringify({ force: true }) : undefined,
        }
    );
}

/**
 * Finish the boss battle — finalizes outcome and writes BossResults.
 * POST /boss-battle-instances/{boss_instance_id}/finish
 *
 * Teacher/admin only.
 * TODO: restrict this endpoint to teacher/admin users
 */
export function finishBossBattle(bossInstanceId: string) {
    return api<FinishBattleResponse>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/finish`,
        { method: "POST" }
    );
}

export function submitBossBattleAnswer(
    bossInstanceId: string,
    payload: SubmitBossAnswerPayload
) {
    return api<SubmitBossAnswerResponse>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/submit-answer`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        }
    );
}

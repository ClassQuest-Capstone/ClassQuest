/**
 * mutation-resolver.ts — AppSync adapter Lambda for Boss Battle mutations.
 *
 * Receives AppSync resolver events and dispatches to existing REST handler logic
 * without modifying any handler file. After each successful state or roster change,
 * calls publish-event.ts to push a subscription event to connected clients.
 *
 * Dispatch pattern mirrors quest-router/router.ts:
 *   AppSync fieldName → existing handler → success? → publish event
 *
 * Auth enforcement mirrors the existing handlers:
 *   Teacher mutations: identity.groups must contain "Teachers"
 *   Student mutations: identity.groups must contain "Students";
 *                      student_id is derived from identity.sub, NOT from arguments
 *
 * IMPORTANT: This Lambda is NOT the existing REST router.
 * REST routes in QuestApiStack remain active in parallel.
 */

import { handler as startBattleHandler }     from "../bossBattleInstances/start-battle.js";
import { handler as startCountdownHandler }  from "../bossBattleInstances/start-countdown.js";
import { handler as startQuestionHandler }   from "../bossBattleInstances/start-question.js";
import { handler as submitAnswerHandler }    from "../bossBattleInstances/submit-answer.js";
import { handler as resolveQuestionHandler } from "../bossBattleInstances/resolve-question.js";
import { handler as advanceQuestionHandler } from "../bossBattleInstances/advance-question.js";
import { handler as finishBattleHandler }    from "../bossBattleInstances/finish-battle.js";

import { handler as joinHandler }            from "../bossBattleParticipants/join.js";
import { handler as spectateHandler }        from "../bossBattleParticipants/spectate.js";
import { handler as leaveHandler }           from "../bossBattleParticipants/leave.js";
import { handler as kickHandler }            from "../bossBattleParticipants/kick.js";

import { getBossBattleInstance }             from "../bossBattleInstances/repo.js";
import { listParticipants }                  from "../bossBattleParticipants/repo.js";

import {
    publishBattleStateChanged,
    publishRosterChanged,
    publishAnswerSubmitted,
    type BossBattleStateEventPayload,
    type BossBattleParticipantPayload,
    type AnswerSubmittedPayload,
} from "./publish-event.js";

import type { BossBattleInstanceItem }    from "../bossBattleInstances/types.js";
import type { BossBattleParticipantItem } from "../bossBattleParticipants/types.js";

// ──────────────────────────────────────────────────────────────────────────────
// Lambda entry point
// ──────────────────────────────────────────────────────────────────────────────

export const handler = async (event: any): Promise<any> => {
    const fieldName: string = event.info?.fieldName ?? "";
    const args: Record<string, any> = event.arguments ?? {};

    // Extract AppSync Cognito USER_POOLS identity
    const identity = event.identity ?? {};
    const sub: string = identity.sub ?? identity.claims?.sub ?? "";
    // AppSync provides groups as a top-level array on the identity object
    const groups: string[] = identity.groups ?? identity.claims?.["cognito:groups"] ?? [];

    // Shape of claims forwarded to existing handlers (which read requestContext.authorizer.jwt.claims)
    const jwtClaims = {
        sub,
        "cognito:groups": groups,
        ...(identity.claims ?? {}),
    };

    switch (fieldName) {
        // ── Lifecycle mutations (teacher) ────────────────────────────────────

        case "startBattle": {
            const ev = makeBossEvent(args.bossInstanceId, null, jwtClaims);
            const res = await startBattleHandler(ev);
            if (res.statusCode === 200) await publishState(args.bossInstanceId);
            return toActionResult(res);
        }

        case "startCountdown": {
            const ev = makeBossEvent(args.bossInstanceId, null, jwtClaims);
            const res = await startCountdownHandler(ev);
            if (res.statusCode === 200) await publishState(args.bossInstanceId);
            return toActionResult(res);
        }

        case "startQuestion": {
            const ev = makeBossEvent(args.bossInstanceId, null, jwtClaims);
            const res = await startQuestionHandler(ev);
            if (res.statusCode === 200) await publishState(args.bossInstanceId);
            return toActionResult(res);
        }

        case "resolveQuestion": {
            const ev = makeBossEvent(args.bossInstanceId, null, jwtClaims);
            const res = await resolveQuestionHandler(ev);
            if (res.statusCode === 200) await publishState(args.bossInstanceId);
            return toActionResult(res);
        }

        case "advanceQuestion": {
            const ev = makeBossEvent(args.bossInstanceId, null, jwtClaims);
            const res = await advanceQuestionHandler(ev);
            if (res.statusCode === 200) await publishState(args.bossInstanceId);
            return toActionResult(res);
        }

        case "finishBattle": {
            const ev = makeBossEvent(args.bossInstanceId, null, jwtClaims);
            const res = await finishBattleHandler(ev);
            if (res.statusCode === 200) await publishState(args.bossInstanceId);
            return toActionResult(res);
        }

        // ── submitAnswer (student) — synchronous feedback + quorum publish ──

        case "submitAnswer": {
            // student_id is derived from identity.sub, never from arguments
            const body = JSON.stringify({ answer_raw: args.answerRaw });
            const ev = makeBossEvent(args.bossInstanceId, body, jwtClaims);
            const res = await submitAnswerHandler(ev);
            if (res.statusCode === 200) {
                const parsed = safeParseJson(res.body);
                // Phase 5: publish per-student answer event for teacher monitor
                await publishAnswer(args.bossInstanceId, sub, parsed);
                // Publish full state update (quorum counters) for all subscribers
                await publishState(args.bossInstanceId);
            }
            return toSubmitResult(res);
        }

        // ── Roster mutations (participant) ───────────────────────────────────

        case "joinBattle": {
            const body = JSON.stringify({ guild_id: args.guildId });
            const ev = makeBossEvent(args.bossInstanceId, body, jwtClaims);
            const res = await joinHandler(ev);
            if (res.statusCode === 200) await publishRoster(args.bossInstanceId);
            return toParticipantResult(res);
        }

        case "spectateBattle": {
            const ev = makeBossEvent(args.bossInstanceId, null, jwtClaims);
            const res = await spectateHandler(ev);
            if (res.statusCode === 200) await publishRoster(args.bossInstanceId);
            return toParticipantResult(res);
        }

        case "leaveBattle": {
            const ev = makeBossEvent(args.bossInstanceId, null, jwtClaims);
            const res = await leaveHandler(ev);
            if (res.statusCode === 200) await publishRoster(args.bossInstanceId);
            return toParticipantResult(res);
        }

        case "kickParticipant": {
            const body = JSON.stringify({ reason: args.reason ?? null });
            const ev = makeKickEvent(args.bossInstanceId, args.studentId, body, jwtClaims);
            const res = await kickHandler(ev);
            if (res.statusCode === 200) await publishRoster(args.bossInstanceId);
            return toParticipantResult(res);
        }

        default:
            return { success: false, statusCode: 400, error: `Unknown mutation field: ${fieldName}` };
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// Event builders — shape AppSync args into the API Gateway event the handlers expect
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a fake API Gateway event for boss battle instance lifecycle handlers.
 * All lifecycle handlers read pathParameters.boss_instance_id and
 * requestContext.authorizer.jwt.claims for auth.
 */
function makeBossEvent(
    bossInstanceId: string,
    body: string | null,
    claims: Record<string, unknown>
) {
    return {
        pathParameters: { boss_instance_id: bossInstanceId },
        body: body ?? null,
        requestContext: {
            authorizer: {
                jwt: { claims },
            },
        },
    };
}

/**
 * Build a fake API Gateway event for kick — needs both boss_instance_id
 * and student_id path parameters.
 */
function makeKickEvent(
    bossInstanceId: string,
    studentId: string,
    body: string | null,
    claims: Record<string, unknown>
) {
    return {
        pathParameters: {
            boss_instance_id: bossInstanceId,
            student_id: studentId,
        },
        body: body ?? null,
        requestContext: {
            authorizer: {
                jwt: { claims },
            },
        },
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// Result mappers — convert handler HTTP responses to GraphQL return types
// ──────────────────────────────────────────────────────────────────────────────

function toActionResult(res: { statusCode: number; body: string }) {
    const body = safeParseJson(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
        return { success: true, statusCode: res.statusCode, message: "OK" };
    }
    return {
        success: false,
        statusCode: res.statusCode,
        error: body?.error ?? `HTTP ${res.statusCode}`,
    };
}

function toSubmitResult(res: { statusCode: number; body: string }) {
    const body = safeParseJson(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
        return { success: true, ...body };
    }
    return {
        success: false,
        error: body?.error ?? `HTTP ${res.statusCode}`,
    };
}

function toParticipantResult(res: { statusCode: number; body: string }) {
    const body = safeParseJson(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) {
        return {
            success: true,
            state: body?.state ?? null,
            message: body?.message ?? "OK",
        };
    }
    return {
        success: false,
        error: body?.error ?? `HTTP ${res.statusCode}`,
    };
}

function safeParseJson(s: string): Record<string, any> {
    try { return JSON.parse(s); } catch { return {}; }
}

// ──────────────────────────────────────────────────────────────────────────────
// Publish helpers — fetch current state from DDB and push subscription event.
// These never throw — publish failures must not roll back the state change.
// ──────────────────────────────────────────────────────────────────────────────

async function publishState(bossInstanceId: string): Promise<void> {
    try {
        const instance = await getBossBattleInstance(bossInstanceId);
        if (!instance) return;
        await publishBattleStateChanged(instanceToStatePayload(instance));
    } catch (err) {
        console.error("[mutation-resolver] publishState error (non-fatal)", { bossInstanceId, err });
    }
}

async function publishRoster(bossInstanceId: string): Promise<void> {
    try {
        const participants = await listParticipants(bossInstanceId);
        await publishRosterChanged(
            bossInstanceId,
            participants.map(participantToPayload)
        );
    } catch (err) {
        console.error("[mutation-resolver] publishRoster error (non-fatal)", { bossInstanceId, err });
    }
}

// Phase 5: publish per-student answer submission event for teacher monitor.
async function publishAnswer(
    bossInstanceId: string,
    studentId: string,
    handlerBody: Record<string, any>
): Promise<void> {
    try {
        const payload: AnswerSubmittedPayload = {
            boss_instance_id:       bossInstanceId,
            student_id:             studentId,
            is_correct:             Boolean(handlerBody.is_correct),
            received_answer_count:  handlerBody.received_answer_count ?? null,
            required_answer_count:  handlerBody.required_answer_count ?? null,
            ready_to_resolve:       handlerBody.ready_to_resolve ?? null,
            updated_at:             new Date().toISOString(),
        };
        await publishAnswerSubmitted(payload);
    } catch (err) {
        console.error("[mutation-resolver] publishAnswer error (non-fatal)", { bossInstanceId, studentId, err });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Payload mappers — DDB items → subscription event payloads
// ──────────────────────────────────────────────────────────────────────────────

function instanceToStatePayload(instance: BossBattleInstanceItem): BossBattleStateEventPayload {
    return {
        boss_instance_id:       instance.boss_instance_id,
        status:                 instance.status,
        current_boss_hp:        instance.current_boss_hp ?? null,
        initial_boss_hp:        instance.initial_boss_hp ?? null,
        active_question_id:     instance.active_question_id ?? null,
        question_started_at:    instance.question_started_at ?? null,
        question_ends_at:       instance.question_ends_at ?? null,
        countdown_end_at:       instance.countdown_end_at ?? null,
        intermission_ends_at:   instance.intermission_ends_at ?? null,
        active_guild_id:        instance.active_guild_id ?? null,
        received_answer_count:  instance.received_answer_count ?? null,
        required_answer_count:  instance.required_answer_count ?? null,
        ready_to_resolve:       instance.ready_to_resolve ?? null,
        // per_guild_active_question_id: null until RANDOMIZED_PER_GUILD handler TODOs
        // in start-question.ts are resolved (each guild needs its own active question ID).
        // per_guild_question_index (guild→index) is present but is not the same as
        // guild→question_id; resolving requires a question plan lookup per guild.
        per_guild_active_question_id: null,
        outcome:                instance.outcome ?? null,
        fail_reason:            instance.fail_reason ?? null,
        completed_at:           instance.completed_at ?? null,
        updated_at:             instance.updated_at,
    };
}

function participantToPayload(p: BossBattleParticipantItem): BossBattleParticipantPayload {
    return {
        boss_instance_id: p.boss_instance_id,
        student_id:       p.student_id,
        class_id:         p.class_id,
        guild_id:         p.guild_id,
        state:            p.state,
        joined_at:        p.joined_at,
        updated_at:       p.updated_at,
        last_submit_at:   p.last_submit_at ?? null,
        frozen_until:     p.frozen_until ?? null,
        is_downed:        p.is_downed,
        downed_at:        p.downed_at ?? null,
        kick_reason:      p.kick_reason ?? null,
    };
}

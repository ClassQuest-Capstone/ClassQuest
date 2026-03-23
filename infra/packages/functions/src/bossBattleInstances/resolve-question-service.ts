import { getBossBattleInstance, resolveQuestion as resolveQuestionRepo } from "./repo.js";
import { BossBattleStatus } from "./types.js";
import { getQuestion } from "../bossQuestions/repo.js";
import {
    listParticipants,
    markParticipantDowned,
} from "../bossBattleParticipants/repo.js";
import { ParticipantState } from "../bossBattleParticipants/types.js";
import { listAttemptsByBattleQuestion, createBossAnswerAttempt } from "../bossAnswerAttempts/repo.js";
import type { BossAnswerAttemptItem } from "../bossAnswerAttempts/types.js";
import { getPlayerState, setPlayerHearts } from "../playerStates/repo.js";

// ---------------------------------------------------------------------------
// Public result type (returned by both the HTTP handler and auto-resolve path)
// ---------------------------------------------------------------------------

export type ResolveQuestionResult = {
    boss_instance_id: string;
    question_id: string;
    total_attempts: number;
    total_damage_to_boss: number;
    new_boss_hp: number;
    status: "INTERMISSION" | "COMPLETED";
    outcome: "WIN" | "FAIL" | null;
    fail_reason: "ALL_GUILDS_DOWN" | null;
    downed_students_count: number;
    affected_guilds_count: number;
};

// ---------------------------------------------------------------------------
// Core service — called from the public HTTP handler AND the auto-resolve path
// ---------------------------------------------------------------------------

/**
 * resolveQuestionCore — authoritative resolution of the active boss question.
 *
 * Applies boss damage, heart penalties, and atomically transitions the battle
 * from QUESTION_ACTIVE → INTERMISSION | COMPLETED.
 *
 * Callers:
 *   - Public ResolveQuestion HTTP handler (after auth + readiness check)
 *   - tryAutoResolveBossQuestion (after quorum detected in SubmitBossAnswer)
 *
 * Throws:
 *   - ConditionalCheckFailedException  →  another request already resolved
 *                                         (safe to treat as no-op in auto-resolve path)
 *   - Any other error                  →  unexpected failure, propagate to caller
 *
 * Note: This function does NOT enforce the pre-call readiness check
 * (timer-expired / ready_to_resolve). That check is the HTTP handler's
 * responsibility. The DynamoDB conditional write is the final idempotency gate.
 *
 * TODO: teacher/admin auth enforcement on the public ResolveQuestion route belongs
 *       in the HTTP handler, not here.
 */
export async function resolveQuestionCore(boss_instance_id: string): Promise<ResolveQuestionResult> {
    // --- 1. Load fresh instance ---
    const instance = await getBossBattleInstance(boss_instance_id);

    if (!instance) {
        throw new Error("Boss battle instance not found");
    }

    // Fast-path: if status has already moved on, signal "already resolved" to callers
    // without executing the expensive aggregation steps.
    if (instance.status !== BossBattleStatus.QUESTION_ACTIVE) {
        const err: any = new Error(
            `Battle is no longer in QUESTION_ACTIVE (current: ${instance.status})`
        );
        err.name = "ConditionalCheckFailedException";
        throw err;
    }

    if (!instance.active_question_id) {
        throw new Error("No active question on this battle instance");
    }

    // --- 2. Load question ---
    const question = await getQuestion(instance.active_question_id);
    if (!question) {
        throw new Error("Active boss question not found");
    }

    // --- 3. Load all attempts for this question (paginate through all pages) ---
    // TODO: RANDOMIZED_PER_GUILD may eventually require per-guild question resolution
    //       rather than one global active_question_id.
    let allAttempts: BossAnswerAttemptItem[] = [];
    let nextToken: string | undefined;
    do {
        const page = await listAttemptsByBattleQuestion(
            boss_instance_id,
            instance.active_question_id,
            { limit: 100, nextToken }
        );
        allAttempts = allAttempts.concat(page.items);
        nextToken = page.nextToken;
    } while (nextToken);

    // --- 3b. Load JOINED participants to detect non-submitters ---
    // Done here (before aggregation) so phantom attempts can be included in step 4.
    const joinedEarly = await listParticipants(boss_instance_id, {
        state: ParticipantState.JOINED,
    });

    const submittedIds = new Set(allAttempts.map((a) => a.student_id));
    const nonSubmitters = joinedEarly.filter(
        (p) => !p.is_downed && !submittedIds.has(p.student_id)
    );

    // Create a phantom "wrong" attempt for each non-submitter so the monitor
    // table shows them as incorrect. No heart penalty (hearts_delta_student: 0)
    // and no boss damage — they simply missed the question.
    if (nonSubmitters.length > 0) {
        await Promise.all(
            nonSubmitters.map((p) =>
                createBossAnswerAttempt({
                    boss_instance_id,
                    class_id: instance.class_id,
                    question_id: instance.active_question_id!,
                    student_id: p.student_id,
                    guild_id: p.guild_id ?? "",
                    answer_raw: { skipped: true, reason: "force_resolve" },
                    is_correct: false,
                    elapsed_seconds: 0,
                    damage_to_boss: 0,
                    hearts_delta_student: -1,
                    hearts_delta_guild_total: 0,
                    mode_type: ((instance as any).mode_type ?? "SIMULTANEOUS_ALL") as any,
                    status_at_submit: "QUESTION_ACTIVE",
                }).catch(() => {
                    // Non-critical — if write fails, monitor just won't show the wrong mark
                })
            )
        );

        // Append phantom attempts to local array so step 4 aggregation includes them
        const ts = new Date().toISOString();
        const phantomAttempts: BossAnswerAttemptItem[] = nonSubmitters.map((p) => ({
            boss_attempt_pk: `BI#${boss_instance_id}#Q#${instance.active_question_id}`,
            attempt_sk: `T#${ts}#S#${p.student_id}#A#phantom`,
            boss_instance_id,
            class_id: instance.class_id,
            question_id: instance.active_question_id!,
            student_id: p.student_id,
            guild_id: p.guild_id ?? "",
            answer_raw: { skipped: true },
            is_correct: false,
            answered_at: ts,
            elapsed_seconds: 0,
            damage_to_boss: 0,
            hearts_delta_student: -1,
            hearts_delta_guild_total: 0,
            mode_type: ((instance as any).mode_type ?? "SIMULTANEOUS_ALL") as any,
            status_at_submit: "QUESTION_ACTIVE" as any,
            gsi2_sk: "",
            gsi3_pk: `${boss_instance_id}#${p.student_id}`,
            gsi3_sk: "",
        }));
        allAttempts = allAttempts.concat(phantomAttempts);
    }

    // --- 4. Aggregate effects from attempts ---
    let total_damage_to_boss = 0;
    const studentDeltas = new Map<string, number>(); // student_id → sum of hearts_delta_student
    const guildDeltas   = new Map<string, number>(); // guild_id   → sum of hearts_delta_guild_total

    for (const attempt of allAttempts) {
        total_damage_to_boss += attempt.damage_to_boss ?? 0;

        if ((attempt.hearts_delta_student ?? 0) < 0) {
            studentDeltas.set(
                attempt.student_id,
                (studentDeltas.get(attempt.student_id) ?? 0) + attempt.hearts_delta_student
            );
        }

        if ((attempt.hearts_delta_guild_total ?? 0) < 0 && attempt.guild_id) {
            guildDeltas.set(
                attempt.guild_id,
                (guildDeltas.get(attempt.guild_id) ?? 0) + attempt.hearts_delta_guild_total
            );
        }
    }

    // --- 5. Compute new boss HP ---
    const new_boss_hp = Math.max(0, instance.current_boss_hp - total_damage_to_boss);

    // --- 6. Use the participant list already loaded in step 3b ---
    const joinedParticipants = joinedEarly;

    const playerStateMap = new Map<string, { hearts: number } | null>();
    await Promise.all(
        joinedParticipants.map(async (p) => {
            const ps = await getPlayerState(instance.class_id, p.student_id);
            playerStateMap.set(p.student_id, ps ? { hearts: ps.hearts } : null);
        })
    );

    const updatedHearts = new Map<string, number>();
    for (const [sid, ps] of playerStateMap.entries()) {
        updatedHearts.set(sid, ps?.hearts ?? 0);
    }

    const downedThisRound = new Set<string>();

    // --- 7. Apply student heart penalties (SIMULTANEOUS_ALL / RANDOMIZED_PER_GUILD) ---
    for (const [student_id, delta] of studentDeltas.entries()) {
        if (!playerStateMap.has(student_id)) continue;
        const old_hearts = updatedHearts.get(student_id) ?? 0;
        const new_hearts = Math.max(0, old_hearts + delta);
        if (new_hearts === old_hearts) continue;

        updatedHearts.set(student_id, new_hearts);
        await setPlayerHearts(instance.class_id, student_id, new_hearts);
        if (new_hearts === 0) {
            downedThisRound.add(student_id);
            await markParticipantDowned(boss_instance_id, student_id);
        }
    }

    // --- 8. Apply guild heart penalties (TURN_BASED_GUILD) ---
    // Distribute penalty one heart at a time from the highest-hearts member (deterministic).
    // TODO: revisit penalty distribution strategy if game design changes
    for (const [guild_id, guildDelta] of guildDeltas.entries()) {
        const totalPenalty = -guildDelta; // positive number

        const guildMembers = joinedParticipants.filter((p) => p.guild_id === guild_id);
        if (guildMembers.length === 0) continue;

        const memberState = guildMembers.map((p) => ({
            student_id: p.student_id,
            hearts: updatedHearts.get(p.student_id) ?? 0,
        }));

        let remaining = totalPenalty;
        while (remaining > 0) {
            memberState.sort(
                (a, b) => b.hearts - a.hearts || a.student_id.localeCompare(b.student_id)
            );
            const top = memberState[0];
            if (top.hearts <= 0) break;
            top.hearts -= 1;
            remaining -= 1;
        }

        for (const member of memberState) {
            const origHearts = updatedHearts.get(member.student_id) ?? 0;
            if (member.hearts === origHearts) continue;

            updatedHearts.set(member.student_id, member.hearts);
            await setPlayerHearts(instance.class_id, member.student_id, member.hearts);
            if (member.hearts === 0) {
                downedThisRound.add(member.student_id);
                await markParticipantDowned(boss_instance_id, member.student_id);
            }
        }
    }

    // --- 9. Determine next battle state ---
    // WIN/FAIL is determined after all questions are asked in auto-advance-question.ts.
    // The battle always continues to INTERMISSION regardless of player HP.
    const next_status: "INTERMISSION" | "COMPLETED" = "INTERMISSION";
    const outcome: "WIN" | "FAIL" | undefined = undefined;
    const fail_reason: "ALL_GUILDS_DOWN" | undefined = undefined;

    // --- 10. TODO: connect boss question resolution to configurable XP/gold reward
    //               transactions once reward config is finalized ---

    // --- 11. Atomically transition instance (conditional guard on QUESTION_ACTIVE) ---
    // If another request resolved first, DynamoDB throws ConditionalCheckFailedException.
    // Callers are responsible for handling this expected race condition.
    const now = new Date().toISOString();
    const updatedInstance = await resolveQuestionRepo(boss_instance_id, {
        new_boss_hp,
        next_status,
        outcome,
        fail_reason,
        updated_at: now,
    });

    return {
        boss_instance_id,
        question_id: instance.active_question_id,
        total_attempts: allAttempts.length,
        total_damage_to_boss,
        new_boss_hp,
        status: updatedInstance.status as "INTERMISSION" | "COMPLETED",
        outcome: updatedInstance.outcome ?? null,
        fail_reason: updatedInstance.fail_reason ?? null,
        downed_students_count: downedThisRound.size,
        affected_guilds_count: guildDeltas.size,
    };
}

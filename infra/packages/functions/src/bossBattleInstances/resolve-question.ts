import { getBossBattleInstance, resolveQuestion as resolveQuestionRepo } from "./repo.js";
import { BossBattleStatus, ModeType } from "./types.js";
import { getQuestion } from "../bossQuestions/repo.js";
import {
    listParticipants,
    markParticipantDowned,
} from "../bossBattleParticipants/repo.js";
import { ParticipantState } from "../bossBattleParticipants/types.js";
import { listAttemptsByBattleQuestion } from "../bossAnswerAttempts/repo.js";
import type { BossAnswerAttemptItem } from "../bossAnswerAttempts/types.js";
import { getPlayerState, setPlayerHearts } from "../playerStates/repo.js";

/**
 * POST /boss-battle-instances/{boss_instance_id}/resolve-question
 *
 * ResolveQuestion — authoritative server-side step that applies damage and
 * penalties for the active boss battle question, then transitions the battle
 * state (QUESTION_ACTIVE → INTERMISSION | COMPLETED).
 *
 * SubmitBossAnswer only validates and logs attempts.
 * Clients must never directly modify boss HP, hearts, or results.
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

        // Authorization: Only teachers and admins can resolve a question
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
                body: JSON.stringify({ error: "Only teachers can resolve a question" }),
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

        if (instance.status !== BossBattleStatus.QUESTION_ACTIVE) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: "ResolveQuestion can only run during QUESTION_ACTIVE",
                    current_status: instance.status,
                }),
            };
        }

        // --- 1b. Validate resolve readiness (answer-gating) ---
        {
            const isTimed = !!instance.question_ends_at;
            const nowCheck = new Date();
            const timerExpired =
                isTimed && nowCheck >= new Date(instance.question_ends_at!);
            const isReady = instance.ready_to_resolve === true;

            // TODO: For RANDOMIZED_PER_GUILD, per-guild readiness should be checked independently
            // once per-guild question tracking is fully supported.

            if (isTimed) {
                if (!isReady && !timerExpired) {
                    return {
                        statusCode: 409,
                        body: JSON.stringify({
                            error: "Question is still waiting for required answers or timer expiry",
                            ready_to_resolve: false,
                            timer_expired: false,
                        }),
                    };
                }
            } else {
                // Untimed: must wait for all required answers
                if (!isReady) {
                    return {
                        statusCode: 409,
                        body: JSON.stringify({
                            error: "Question cannot be resolved until all required participants have answered",
                            received_answer_count: instance.received_answer_count ?? 0,
                            required_answer_count: instance.required_answer_count ?? 0,
                        }),
                    };
                }
            }
        }

        if (!instance.active_question_id) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "No active question on this battle instance" }),
            };
        }

        // --- 2. Load question ---
        const question = await getQuestion(instance.active_question_id);

        if (!question) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Active boss question not found" }),
            };
        }

        // --- 3. Load all attempts for this question (paginate through all pages) ---
        // TODO: RANDOMIZED_PER_GUILD may eventually require per-guild question resolution rather than one global active_question_id
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

        // --- 4. Aggregate effects from attempts ---
        let total_damage_to_boss = 0;
        const studentDeltas = new Map<string, number>(); // student_id → sum of hearts_delta_student
        const guildDeltas = new Map<string, number>();   // guild_id → sum of hearts_delta_guild_total

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

        // --- 6. Load all JOINED participants + their PlayerStates (upfront, in parallel) ---
        const joinedParticipants = await listParticipants(boss_instance_id, {
            state: ParticipantState.JOINED,
        });

        // Cache player states keyed by student_id; null if record missing
        const playerStateMap = new Map<string, { hearts: number } | null>();
        await Promise.all(
            joinedParticipants.map(async (p) => {
                const ps = await getPlayerState(instance.class_id, p.student_id);
                playerStateMap.set(p.student_id, ps ? { hearts: ps.hearts } : null);
            })
        );

        // Track updated hearts in-memory (starts from loaded values)
        const updatedHearts = new Map<string, number>();
        for (const [sid, ps] of playerStateMap.entries()) {
            updatedHearts.set(sid, ps?.hearts ?? 0);
        }

        // Students downed during this resolution
        const downedThisRound = new Set<string>();

        // --- 7. Apply student heart penalties (SIMULTANEOUS_ALL / RANDOMIZED_PER_GUILD) ---
        for (const [student_id, delta] of studentDeltas.entries()) {
            if (!playerStateMap.has(student_id)) continue; // not a tracked participant
            const old_hearts = updatedHearts.get(student_id) ?? 0;
            const new_hearts = Math.max(0, old_hearts + delta);
            if (new_hearts === old_hearts) continue; // no change

            updatedHearts.set(student_id, new_hearts);
            await setPlayerHearts(instance.class_id, student_id, new_hearts);
            if (new_hearts === 0) {
                downedThisRound.add(student_id);
                await markParticipantDowned(boss_instance_id, student_id);
            }
        }

        // --- 8. Apply guild heart penalties (TURN_BASED_GUILD) ---
        // Distribute guild penalty one heart at a time from the highest-hearts member (deterministic).
        // TODO: revisit penalty distribution strategy if game design changes
        for (const [guild_id, guildDelta] of guildDeltas.entries()) {
            const totalPenalty = -guildDelta; // positive number

            // Filter JOINED guild members from already-loaded participants
            const guildMembers = joinedParticipants.filter((p) => p.guild_id === guild_id);
            if (guildMembers.length === 0) continue;

            // Build mutable in-memory state for distribution
            const memberState = guildMembers.map((p) => ({
                student_id: p.student_id,
                hearts: updatedHearts.get(p.student_id) ?? 0,
            }));

            // Apply penalty: subtract 1 heart from highest-hearts member, repeat
            let remaining = totalPenalty;
            while (remaining > 0) {
                memberState.sort(
                    (a, b) =>
                        b.hearts - a.hearts ||
                        a.student_id.localeCompare(b.student_id)
                );
                const top = memberState[0];
                if (top.hearts <= 0) break;
                top.hearts -= 1;
                remaining -= 1;
            }

            // Write updates for members whose hearts changed
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
        let next_status: "INTERMISSION" | "COMPLETED";
        let outcome: "WIN" | "FAIL" | undefined;
        let fail_reason: "ALL_GUILDS_DOWN" | undefined;

        if (new_boss_hp === 0) {
            next_status = "COMPLETED";
            outcome = "WIN";
        } else {
            // Check if all guilds are effectively down
            // A guild is down when every JOINED member is downed (pre-existing or this round) or has 0 hearts
            const guildMemberMap = new Map<string, string[]>();
            for (const p of joinedParticipants) {
                if (!p.guild_id) continue;
                if (!guildMemberMap.has(p.guild_id)) guildMemberMap.set(p.guild_id, []);
                guildMemberMap.get(p.guild_id)!.push(p.student_id);
            }

            let allGuildsDown = guildMemberMap.size > 0;
            for (const memberIds of guildMemberMap.values()) {
                const guildIsDown = memberIds.every((sid) => {
                    const participant = joinedParticipants.find((p) => p.student_id === sid);
                    return (
                        participant?.is_downed === true ||
                        downedThisRound.has(sid) ||
                        (updatedHearts.get(sid) ?? 0) === 0
                    );
                });
                if (!guildIsDown) {
                    allGuildsDown = false;
                    break;
                }
            }

            if (allGuildsDown) {
                next_status = "COMPLETED";
                outcome = "FAIL";
                fail_reason = "ALL_GUILDS_DOWN";
            } else {
                next_status = "INTERMISSION";
            }
        }

        // --- 10. TODO: connect boss question resolution to configurable XP/gold reward transactions once reward config is finalized ---

        // --- 11. Atomically transition instance (conditional guard on QUESTION_ACTIVE) ---
        const now = new Date().toISOString();
        let updatedInstance;
        try {
            updatedInstance = await resolveQuestionRepo(boss_instance_id, {
                new_boss_hp,
                next_status,
                outcome,
                fail_reason,
                updated_at: now,
            });
        } catch (err: any) {
            if (err?.name === "ConditionalCheckFailedException") {
                return {
                    statusCode: 409,
                    body: JSON.stringify({
                        error: "Already resolved — battle is no longer in QUESTION_ACTIVE",
                    }),
                };
            }
            throw err;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                boss_instance_id,
                question_id: instance.active_question_id,
                total_attempts: allAttempts.length,
                total_damage_to_boss,
                new_boss_hp,
                status: updatedInstance.status,
                outcome: updatedInstance.outcome ?? null,
                fail_reason: updatedInstance.fail_reason ?? null,
                downed_students_count: downedThisRound.size,
                affected_guilds_count: guildDeltas.size,
            }),
        };
    } catch (error: any) {
        console.error("Error resolving boss battle question:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

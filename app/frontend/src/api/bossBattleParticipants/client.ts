import { api } from "../http.js";
import type {
    BossBattleParticipant,
    JoinParticipantInput,
    KickParticipantInput,
    ParticipantsListResponse,
    ParticipantState,
} from "./types.js";

/**
 * Join a boss battle
 * POST /boss-battle-instances/{boss_instance_id}/participants/join
 */
export function joinBossBattle(
    bossInstanceId: string,
    input: JoinParticipantInput
) {
    return api<{ message: string; state: ParticipantState }>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/participants/join`,
        {
            method: "POST",
            body: JSON.stringify(input),
        }
    );
}

/**
 * Set participant to spectate mode
 * POST /boss-battle-instances/{boss_instance_id}/participants/spectate
 */
export function spectateBossBattle(bossInstanceId: string) {
    return api<{ message: string }>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/participants/spectate`,
        {
            method: "POST",
        }
    );
}

/**
 * Leave a boss battle
 * POST /boss-battle-instances/{boss_instance_id}/participants/leave
 */
export function leaveBossBattle(bossInstanceId: string) {
    return api<{ message: string }>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/participants/leave`,
        {
            method: "POST",
        }
    );
}

/**
 * List participants in a boss battle
 * GET /boss-battle-instances/{boss_instance_id}/participants
 */
export function listBossBattleParticipants(
    bossInstanceId: string,
    options?: {
        state?: ParticipantState;
    }
) {
    const params = new URLSearchParams();
    if (options?.state) params.append("state", options.state);

    const qs = params.toString();
    return api<ParticipantsListResponse>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/participants${qs ? `?${qs}` : ""}`
    );
}

/**
 * Kick a participant from a boss battle (teacher only)
 * POST /boss-battle-instances/{boss_instance_id}/participants/{student_id}/kick
 */
export function kickParticipant(
    bossInstanceId: string,
    studentId: string,
    input?: KickParticipantInput
) {
    return api<{ message: string }>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/participants/${encodeURIComponent(studentId)}/kick`,
        {
            method: "POST",
            body: JSON.stringify(input || {}),
        }
    );
}

import { api } from "./http.js";

export type PlayerStatus = "ALIVE" | "DOWNED" | "BANNED";

export type PlayerState = {
    class_id: string;
    student_id: string;
    current_xp: number;
    xp_to_next_level: number;
    total_xp_earned: number;
    hearts: number;
    max_hearts: number;
    gold: number;
    last_weekend_reset_at?: string;
    status: PlayerStatus;
    leaderboard_sort: string;
    created_at: string;
    updated_at: string;
};

export type UpsertPlayerStateInput = {
    current_xp: number;
    xp_to_next_level: number;
    total_xp_earned: number;
    hearts: number;
    max_hearts: number;
    gold: number;
    last_weekend_reset_at?: string;
    status: PlayerStatus;
};

export type LeaderboardResponse = {
    items: PlayerState[];
    nextCursor?: string;
    hasMore: boolean;
};

/**
 * Upsert (create or update) a player state
 */
export function upsertPlayerState(
    class_id: string,
    student_id: string,
    input: UpsertPlayerStateInput
) {
    return api<{ ok: true; class_id: string; student_id: string }>(
        `/classes/${encodeURIComponent(class_id)}/players/${encodeURIComponent(student_id)}/state`,
        {
            method: "PUT",
            body: JSON.stringify(input),
        }
    );
}

/**
 * Get a player state by class and student ID
 */
export function getPlayerState(class_id: string, student_id: string) {
    return api<PlayerState>(
        `/classes/${encodeURIComponent(class_id)}/players/${encodeURIComponent(student_id)}/state`
    );
}

/**
 * Get leaderboard for a class with pagination
 * @param class_id - Class identifier
 * @param limit - Number of results to return (default: 50, max: 100)
 * @param cursor - Pagination cursor from previous response
 */
export function getLeaderboard(class_id: string, limit?: number, cursor?: string) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", limit.toString());
    if (cursor) params.set("cursor", cursor);

    const query = params.toString() ? `?${params.toString()}` : "";
    return api<LeaderboardResponse>(
        `/classes/${encodeURIComponent(class_id)}/leaderboard${query}`
    );
}

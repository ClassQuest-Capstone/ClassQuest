/**
 * Boss Results type definitions
 * Matches the actual backend response from GET /boss-battle-instances/{id}/results
 */

export type BossResultStudentRow = {
    student_id: string;
    guild_id: string;
    total_correct: number;
    total_incorrect: number;
    total_attempts: number;
    total_damage_to_boss: number;
    hearts_lost: number;
    xp_awarded: number;
    gold_awarded: number;
    participation_state: string;
    last_answered_at?: string;
};

export type BossResultGuildRow = {
    guild_id: string;
    guild_total_correct: number;
    guild_total_incorrect: number;
    guild_total_attempts: number;
    guild_total_damage_to_boss: number;
    guild_total_hearts_lost: number;
    guild_xp_awarded_total: number;
    guild_gold_awarded_total: number;
    guild_members_joined: number;
    guild_members_downed: number;
    contribution_rank?: number;
    contribution_bonus_pct?: number;
};

export type BossResultsResponse = {
    outcome: "WIN" | "FAIL" | "ABORTED";
    completed_at: string;
    fail_reason?: string;
    guild_results: BossResultGuildRow[];
    student_results: BossResultStudentRow[];
};

export type BossResultStudentList = {
    items: BossResultStudentRow[];
    cursor?: string;
};

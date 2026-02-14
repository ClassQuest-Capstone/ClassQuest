export type PlayerStateStatus = "ALIVE" | "DOWNED" | "BANNED";

export type PlayerStateItem = {
    class_id: string;
    student_id: string;
    current_xp: number;
    xp_to_next_level: number;
    total_xp_earned: number;
    hearts: number;
    max_hearts: number;
    gold: number;
    last_weekend_reset_at?: string;  // ISO 8601 timestamp
    status: PlayerStateStatus;
    leaderboard_sort: string;  // computed field
    created_at: string;
    updated_at: string;
};

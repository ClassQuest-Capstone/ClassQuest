/**
 * Boss Battle Instance type definitions
 */

export type BossBattleStatus =
    | "DRAFT"
    | "LOBBY"
    | "COUNTDOWN"
    | "QUESTION_ACTIVE"
    | "RESOLVING"
    | "INTERMISSION"
    | "COMPLETED"
    | "ABORTED";

export type ModeType =
    | "SIMULTANEOUS_ALL"
    | "TURN_BASED_GUILD"
    | "RANDOMIZED_PER_GUILD";

export type QuestionSelectionMode =
    | "ORDERED"
    | "RANDOM_NO_REPEAT";

export type LateJoinPolicy =
    | "DISALLOW_AFTER_COUNTDOWN"
    | "ALLOW_SPECTATE";

export type TurnPolicy =
    | "ROUND_ROBIN"
    | "RANDOM_NEXT_GUILD"
    | "TEACHER_SELECTS_NEXT";

export type BattleOutcome =
    | "WIN"
    | "FAIL"
    | "ABORTED";

export type FailReason =
    | "TIMEOUT"
    | "ALL_GUILDS_DOWN"
    | "OUT_OF_QUESTIONS"
    | "ABORTED_BY_TEACHER";

export type BossBattleInstance = {
    boss_instance_id: string;
    class_id: string;
    boss_template_id: string;
    created_by_teacher_id: string;
    status: BossBattleStatus;
    mode_type: ModeType;
    question_selection_mode: QuestionSelectionMode;
    initial_boss_hp: number;
    current_boss_hp: number;
    lobby_opened_at?: string;
    countdown_seconds?: number;
    countdown_end_at?: string;
    active_question_id?: string;
    question_started_at?: string;
    question_ends_at?: string;
    intermission_ends_at?: string;
    completed_at?: string;
    speed_bonus_enabled: boolean;
    speed_bonus_floor_multiplier: number;
    speed_window_seconds: number;
    time_limit_seconds_default?: number;
    anti_spam_min_submit_interval_ms: number;
    freeze_on_wrong_seconds: number;
    late_join_policy: LateJoinPolicy;
    participants_snapshot_id?: string;
    question_plan_id?: string;
    guild_question_plan_id?: string;
    current_question_index: number;
    per_guild_question_index?: Record<string, number>;
    active_guild_id?: string;
    turn_policy?: TurnPolicy;
    outcome?: BattleOutcome;
    fail_reason?: FailReason;
    created_at: string;
    updated_at: string;
};

export type CreateBossBattleInstanceInput = {
    class_id: string;
    boss_template_id: string;
    initial_boss_hp: number;
    mode_type?: ModeType;
    question_selection_mode?: QuestionSelectionMode;
    speed_bonus_enabled?: boolean;
    speed_bonus_floor_multiplier?: number;
    speed_window_seconds?: number;
    time_limit_seconds_default?: number;
    anti_spam_min_submit_interval_ms?: number;
    freeze_on_wrong_seconds?: number;
    late_join_policy?: LateJoinPolicy;
    turn_policy?: TurnPolicy;
};

export type UpdateBossBattleInstanceInput = Partial<{
    status: BossBattleStatus;
    current_boss_hp: number;
    lobby_opened_at: string;
    countdown_seconds: number;
    countdown_end_at: string;
    active_question_id: string;
    question_started_at: string;
    question_ends_at: string;
    intermission_ends_at: string;
    completed_at: string;
    current_question_index: number;
    per_guild_question_index: Record<string, number>;
    active_guild_id: string;
    outcome: BattleOutcome;
    fail_reason: FailReason;
    participants_snapshot_id: string;
    question_plan_id: string;
    guild_question_plan_id: string;
}>;

export type PaginatedBossBattleInstances = {
    items: BossBattleInstance[];
    cursor?: string;
};

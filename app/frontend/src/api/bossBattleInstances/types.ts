/**
 * Boss Battle Instance type definitions
 */

export type BossBattleStatus =
    | "DRAFT"
    | "ACTIVE"
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
    // Answer-gating runtime state (reset each StartQuestion)
    required_answer_count?: number;
    received_answer_count?: number;
    ready_to_resolve?: boolean;
    per_guild_required_answer_count?: Record<string, number>;
    per_guild_received_answer_count?: Record<string, number>;
    per_guild_ready_to_resolve?: Record<string, boolean>;
    created_at: string;
    updated_at: string;
};

export type CreateBossBattleInstanceInput = {
    class_id: string;
    boss_template_id: string;
    created_by_teacher_id: string;
    initial_boss_hp: number;
    status?: BossBattleStatus;
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

export type SubmitBossAnswerPayload = {
    student_id: string;
    answer_raw: Record<string, unknown>;
};

export type FinishBattleResponse = {
    boss_instance_id: string;
    status: BossBattleStatus;
    outcome: "WIN" | "FAIL" | null;
    fail_reason: "ALL_GUILDS_DOWN" | "OUT_OF_QUESTIONS" | "ABORTED_BY_TEACHER" | null;
    completed_at: string;
    results_written: boolean;
};

export type AdvanceQuestionResponse = {
    boss_instance_id: string;
    status: BossBattleStatus;
    current_question_index: number;
    per_guild_question_index: Record<string, number> | null;
    outcome: "WIN" | "FAIL" | null;
    fail_reason: "OUT_OF_QUESTIONS" | null;
    has_more_questions: boolean;
};

export type ResolveQuestionResponse = {
    boss_instance_id: string;
    question_id: string;
    total_attempts: number;
    total_damage_to_boss: number;
    new_boss_hp: number;
    status: BossBattleStatus;
    outcome: "WIN" | "FAIL" | null;
    fail_reason: "ALL_GUILDS_DOWN" | null;
    downed_students_count: number;
    affected_guilds_count: number;
};

export type SubmitBossAnswerResponse = {
    is_correct: boolean;
    answered_at: string;
    elapsed_seconds: number;
    effective_time_limit_seconds: number | null;
    speed_multiplier: number;
    damage_to_boss: number;
    hearts_delta_student: number;
    hearts_delta_guild_total: number;
    frozen_until: string | null;
    received_answer_count: number;
    required_answer_count: number;
    ready_to_resolve: boolean;
};

/**
 * Boss Battle Instance status lifecycle
 */
export enum BossBattleStatus {
    DRAFT = "DRAFT",
    LOBBY = "LOBBY",
    COUNTDOWN = "COUNTDOWN",
    QUESTION_ACTIVE = "QUESTION_ACTIVE",
    RESOLVING = "RESOLVING",
    INTERMISSION = "INTERMISSION",
    COMPLETED = "COMPLETED",
    ABORTED = "ABORTED"
}

/**
 * Mode type for how students participate
 */
export enum ModeType {
    SIMULTANEOUS_ALL = "SIMULTANEOUS_ALL",
    TURN_BASED_GUILD = "TURN_BASED_GUILD",
    RANDOMIZED_PER_GUILD = "RANDOMIZED_PER_GUILD"
}

/**
 * Question selection strategy
 */
export enum QuestionSelectionMode {
    ORDERED = "ORDERED",
    RANDOM_NO_REPEAT = "RANDOM_NO_REPEAT"
}

/**
 * Late join policy
 */
export enum LateJoinPolicy {
    DISALLOW_AFTER_COUNTDOWN = "DISALLOW_AFTER_COUNTDOWN",
    ALLOW_SPECTATE = "ALLOW_SPECTATE"
}

/**
 * Turn policy for turn-based mode
 */
export enum TurnPolicy {
    ROUND_ROBIN = "ROUND_ROBIN",
    RANDOM_NEXT_GUILD = "RANDOM_NEXT_GUILD",
    TEACHER_SELECTS_NEXT = "TEACHER_SELECTS_NEXT"
}

/**
 * Battle outcome
 */
export enum BattleOutcome {
    WIN = "WIN",
    FAIL = "FAIL",
    ABORTED = "ABORTED"
}

/**
 * Fail reason
 */
export enum FailReason {
    TIMEOUT = "TIMEOUT",
    ALL_GUILDS_DOWN = "ALL_GUILDS_DOWN",
    OUT_OF_QUESTIONS = "OUT_OF_QUESTIONS",
    ABORTED_BY_TEACHER = "ABORTED_BY_TEACHER"
}

/**
 * Boss Battle Instance stored in DynamoDB
 */
export type BossBattleInstanceItem = {
    // Primary key
    boss_instance_id: string;

    // Core references
    class_id: string;
    boss_template_id: string;
    created_by_teacher_id: string;

    // Status
    status: BossBattleStatus;
    mode_type: ModeType;
    question_selection_mode: QuestionSelectionMode;

    // HP tracking
    initial_boss_hp: number;
    current_boss_hp: number;

    // Timing / lifecycle (nullable ISO strings)
    lobby_opened_at?: string;
    countdown_seconds?: number;
    countdown_end_at?: string;
    active_question_id?: string;
    question_started_at?: string;
    question_ends_at?: string;
    intermission_ends_at?: string;
    completed_at?: string;

    // Speed bonus config
    speed_bonus_enabled: boolean;
    speed_bonus_floor_multiplier: number;
    speed_window_seconds: number;
    time_limit_seconds_default?: number;

    // Anti-spam / penalties
    anti_spam_min_submit_interval_ms: number;
    freeze_on_wrong_seconds: number;

    // Late join policy
    late_join_policy: LateJoinPolicy;

    // Plans + snapshots (pointers)
    participants_snapshot_id?: string;
    question_plan_id?: string;
    guild_question_plan_id?: string;
    current_question_index: number;
    per_guild_question_index?: Record<string, number>;
    active_guild_id?: string;
    turn_policy?: TurnPolicy;

    // Outcome (set when completed/aborted)
    outcome?: BattleOutcome;
    fail_reason?: FailReason;

    // Audit
    created_at: string;
    updated_at: string;
};

/**
 * Input for creating a new boss battle instance
 */
export type CreateBossBattleInstanceInput = {
    class_id: string;
    boss_template_id: string;
    created_by_teacher_id: string;
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

/**
 * Input for updating a boss battle instance
 */
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

/**
 * Apply default values for optional fields
 */
export function applyBattleDefaults(
    input: CreateBossBattleInstanceInput
): Omit<BossBattleInstanceItem, "boss_instance_id" | "created_at" | "updated_at"> {
    return {
        class_id: input.class_id,
        boss_template_id: input.boss_template_id,
        created_by_teacher_id: input.created_by_teacher_id,
        status: BossBattleStatus.DRAFT,
        mode_type: input.mode_type ?? ModeType.SIMULTANEOUS_ALL,
        question_selection_mode: input.question_selection_mode ?? QuestionSelectionMode.ORDERED,
        initial_boss_hp: input.initial_boss_hp,
        current_boss_hp: input.initial_boss_hp,
        speed_bonus_enabled: input.speed_bonus_enabled ?? true,
        speed_bonus_floor_multiplier: input.speed_bonus_floor_multiplier ?? 0.2,
        speed_window_seconds: input.speed_window_seconds ?? 30,
        time_limit_seconds_default: input.time_limit_seconds_default,
        anti_spam_min_submit_interval_ms: input.anti_spam_min_submit_interval_ms ?? 1500,
        freeze_on_wrong_seconds: input.freeze_on_wrong_seconds ?? 3,
        late_join_policy: input.late_join_policy ?? LateJoinPolicy.DISALLOW_AFTER_COUNTDOWN,
        current_question_index: 0,
        turn_policy: input.turn_policy,
    };
}

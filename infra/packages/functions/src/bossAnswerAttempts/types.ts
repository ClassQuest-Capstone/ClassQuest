/**
 * BossAnswerAttempts type definitions
 * Immutable combat log of boss battle submissions
 */

// Mode types (for auditing)
export type ModeType =
    | "SIMULTANEOUS_ALL"
    | "TURN_BASED_GUILD"
    | "RANDOMIZED_PER_GUILD";

// Status at submit time (for auditing)
export type BattleStatus =
    | "DRAFT"
    | "LOBBY"
    | "COUNTDOWN"
    | "QUESTION_ACTIVE"
    | "RESOLVING"
    | "INTERMISSION"
    | "COMPLETED"
    | "ABORTED";

// DynamoDB item structure
export type BossAnswerAttemptItem = {
    // Primary key
    boss_attempt_pk: string;           // PK: BI#<boss_instance_id>#Q#<question_id>
    attempt_sk: string;                // SK: T#<answered_at>#S#<student_id>#A#<uuid>

    // Core identifiers
    boss_instance_id: string;
    class_id: string;
    question_id: string;
    student_id: string;
    guild_id: string;

    // Answer data
    answer_raw: Record<string, any>;   // Map/object
    is_correct: boolean;
    answered_at: string;               // ISO 8601 timestamp

    // Speed / timing
    elapsed_seconds: number;
    effective_time_limit_seconds?: number;  // Nullable
    speed_multiplier?: number;              // Nullable (0..1)

    // Effects
    damage_to_boss: number;
    hearts_delta_student: number;           // Usually 0 or negative
    hearts_delta_guild_total: number;       // Usually 0 or negative (TURN_BASED_GUILD wrong)

    // Auditing
    mode_type: ModeType;
    status_at_submit: BattleStatus;

    // Optional linkage
    reward_txn_id?: string;            // If creating RewardTransactions per-question
    auto_grade_result?: Record<string, any>;  // Grading detail

    // GSI keys
    gsi2_sk: string;                   // answered_at#boss_instance_id#question_id
    gsi3_pk: string;                   // boss_instance_id#student_id
    gsi3_sk: string;                   // answered_at#question_id
};

// Input for creating an attempt
export type CreateBossAnswerAttemptInput = {
    boss_instance_id: string;
    class_id: string;
    question_id: string;
    student_id: string;
    guild_id: string;
    answer_raw: Record<string, any>;
    is_correct: boolean;
    elapsed_seconds: number;
    effective_time_limit_seconds?: number;
    speed_multiplier?: number;
    damage_to_boss: number;
    hearts_delta_student: number;
    hearts_delta_guild_total: number;
    mode_type: ModeType;
    status_at_submit: BattleStatus;
    reward_txn_id?: string;
    auto_grade_result?: Record<string, any>;
};

// Paginated list response
export type PaginatedBossAnswerAttempts = {
    items: BossAnswerAttemptItem[];
    nextToken?: string;
};

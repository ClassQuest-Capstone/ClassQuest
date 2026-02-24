/**
 * BossResults type definitions
 * Immutable post-battle aggregated summaries
 */

// Battle outcome
export type BattleOutcome = "WIN" | "FAIL" | "ABORTED";

// Fail reason
export type FailReason =
    | "TIMEOUT"
    | "ALL_GUILDS_DOWN"
    | "OUT_OF_QUESTIONS"
    | "ABORTED_BY_TEACHER";

// Participation state (derived from BossBattleParticipants)
export type ParticipationState =
    | "JOINED"
    | "SPECTATE"
    | "KICKED"
    | "LEFT"
    | "DOWNED";

// Student result row
export type BossResultStudentRow = {
    // Keys
    boss_result_pk: string;           // BI#<boss_instance_id>
    boss_result_sk: string;           // STU#<student_id>

    // Common
    boss_instance_id: string;
    class_id: string;
    boss_template_id: string;
    outcome: BattleOutcome;
    completed_at: string;             // ISO timestamp
    created_at: string;               // ISO timestamp

    // Student-specific
    student_id: string;
    guild_id: string;
    total_correct: number;
    total_incorrect: number;
    total_attempts: number;
    total_damage_to_boss: number;
    hearts_lost: number;
    xp_awarded: number;
    gold_awarded: number;
    participation_state: ParticipationState;
    last_answered_at?: string;        // ISO timestamp

    // GSI1 keys (student history)
    gsi1_sk: string;                  // completed_at#boss_instance_id

    // GSI2 keys (class history)
    gsi2_sk: string;                  // completed_at#boss_instance_id

    // Optional
    fail_reason?: FailReason;
    reward_txn_ids?: string[];
};

// Guild result row
export type BossResultGuildRow = {
    // Keys
    boss_result_pk: string;           // BI#<boss_instance_id>
    boss_result_sk: string;           // GUILD#<guild_id>

    // Common
    boss_instance_id: string;
    class_id: string;
    boss_template_id: string;
    outcome: BattleOutcome;
    completed_at: string;             // ISO timestamp
    created_at: string;               // ISO timestamp

    // Guild-specific
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

    // GSI2 keys (class history) - no GSI1 for guild rows
    class_id: string;
    gsi2_sk: string;                  // completed_at#boss_instance_id

    // Optional
    fail_reason?: FailReason;
};

// Meta row for idempotency
export type BossResultMetaRow = {
    boss_result_pk: string;           // BI#<boss_instance_id>
    boss_result_sk: string;           // META
    boss_instance_id: string;
    created_at: string;               // ISO timestamp
    aggregated_by: string;            // Function/user that created results
};

// Union type
export type BossResultRow =
    | BossResultStudentRow
    | BossResultGuildRow
    | BossResultMetaRow;

// Response types
export type GetBossResultsResponse = {
    outcome: BattleOutcome;
    completed_at: string;
    fail_reason?: FailReason;
    guild_results: BossResultGuildRow[];
    student_results: BossResultStudentRow[];
};

export type PaginatedBossResults = {
    items: BossResultStudentRow[];
    nextToken?: string;
};

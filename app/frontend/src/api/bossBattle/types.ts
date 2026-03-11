/**
 * TypeScript types for GraphQL responses from the Boss Battle AppSync API.
 *
 * Phase 2: added BossBattleParticipantGql, BossQuestionGql, and subscription event types.
 */

/** AWSJSON fields are returned as strings by AppSync; parse with JSON.parse() when needed. */
export interface BossBattleInstanceGql {
    boss_instance_id: string;
    class_id: string;
    boss_template_id: string;
    created_by_teacher_id: string;

    // Lifecycle
    status: string;
    mode_type: string;
    question_selection_mode: string | null;
    outcome: string | null;
    fail_reason: string | null;

    // Boss HP
    current_boss_hp: number | null;
    initial_boss_hp: number | null;

    // Active question state
    active_question_id: string | null;
    active_guild_id: string | null;
    question_started_at: string | null;
    question_ends_at: string | null;

    // Timing
    countdown_end_at: string | null;
    countdown_seconds: number | null;
    intermission_ends_at: string | null;

    // Answer-gating
    received_answer_count: number | null;
    required_answer_count: number | null;
    ready_to_resolve: boolean | null;

    // Per-guild (RANDOMIZED_PER_GUILD) — AWSJSON returned as string; JSON.parse() to use
    per_guild_received_answer_count: string | null;
    per_guild_required_answer_count: string | null;
    per_guild_ready_to_resolve: string | null;
    per_guild_active_question_id: string | null;

    // Plan references
    question_plan_id: string | null;
    guild_question_plan_id: string | null;
    participants_snapshot_id: string | null;

    // Timestamps
    lobby_opened_at: string | null;
    completed_at: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface BossBattleParticipantGql {
    boss_instance_id: string;
    student_id: string;
    class_id: string;
    guild_id: string;
    state: string;
    joined_at: string;
    updated_at: string;
    last_submit_at: string | null;
    frozen_until: string | null;
    is_downed: boolean;
    downed_at: string | null;
    kick_reason: string | null;
}

/** correct_answer is null when the caller is in the Students Cognito group. */
export interface BossQuestionGql {
    question_id: string;
    boss_template_id: string;
    order_index: number;
    order_key: string;
    question_text: string;
    question_type: string;
    options: string | null;          // AWSJSON — parse with JSON.parse()
    correct_answer: string | null;   // AWSJSON — null for Students group callers
    damage_to_boss_on_correct: number;
    damage_to_guild_on_incorrect: number;
    max_points: number | null;
    auto_gradable: boolean;
    time_limit_seconds: number | null;
    created_at: string;
    updated_at: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Subscription event payload types
// ──────────────────────────────────────────────────────────────────────────────

/** Payload delivered by onBattleStateChanged subscription after each lifecycle mutation. */
export interface BossBattleStateEvent {
    boss_instance_id: string;
    status: string;
    current_boss_hp: number | null;
    initial_boss_hp: number | null;
    active_question_id: string | null;
    question_started_at: string | null;
    question_ends_at: string | null;
    countdown_end_at: string | null;
    intermission_ends_at: string | null;
    active_guild_id: string | null;
    received_answer_count: number | null;
    required_answer_count: number | null;
    ready_to_resolve: boolean | null;
    per_guild_active_question_id: string | null; // AWSJSON string
    outcome: string | null;
    fail_reason: string | null;
    completed_at: string | null;
    updated_at: string | null;
}

/** Payload delivered by onRosterChanged subscription after join/spectate/leave/kick. */
export interface RosterChangedEvent {
    boss_instance_id: string;
    participants: BossBattleParticipantGql[];
}

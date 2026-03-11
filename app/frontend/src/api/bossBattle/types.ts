/**
 * TypeScript types for GraphQL responses from the Boss Battle AppSync API.
 *
 * Phase 1: BossBattleInstanceGql mirrors the schema.graphql BossBattleInstance type.
 * Phase 2 will add BossBattleParticipantGql, BossQuestionGql, subscription event types.
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

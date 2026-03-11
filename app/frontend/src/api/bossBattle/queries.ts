/**
 * GraphQL query strings for the Boss Battle AppSync API.
 *
 * Phase 1: getBossBattleInstance only.
 * Phase 2 will add listBossBattleInstancesByClass, getBossBattleParticipants,
 * and getActiveBossQuestion.
 */

export const GET_BOSS_BATTLE_INSTANCE = /* GraphQL */ `
  query GetBossBattleInstance($bossInstanceId: ID!) {
    getBossBattleInstance(bossInstanceId: $bossInstanceId) {
      boss_instance_id
      class_id
      boss_template_id
      created_by_teacher_id
      status
      mode_type
      question_selection_mode
      outcome
      fail_reason
      current_boss_hp
      initial_boss_hp
      active_question_id
      active_guild_id
      question_started_at
      question_ends_at
      countdown_end_at
      countdown_seconds
      intermission_ends_at
      received_answer_count
      required_answer_count
      ready_to_resolve
      per_guild_received_answer_count
      per_guild_required_answer_count
      per_guild_ready_to_resolve
      per_guild_active_question_id
      question_plan_id
      guild_question_plan_id
      participants_snapshot_id
      lobby_opened_at
      completed_at
      created_at
      updated_at
    }
  }
`;

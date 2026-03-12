/**
 * GraphQL query strings for the Boss Battle AppSync API.
 *
 * Phase 2: added listBossBattleInstancesByClass, getBossBattleParticipants,
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

export const LIST_BOSS_BATTLE_INSTANCES_BY_CLASS = /* GraphQL */ `
  query ListBossBattleInstancesByClass($classId: ID!) {
    listBossBattleInstancesByClass(classId: $classId) {
      boss_instance_id
      class_id
      boss_template_id
      created_by_teacher_id
      status
      mode_type
      outcome
      fail_reason
      current_boss_hp
      initial_boss_hp
      countdown_end_at
      completed_at
      created_at
      updated_at
    }
  }
`;

export const GET_BOSS_BATTLE_PARTICIPANTS = /* GraphQL */ `
  query GetBossBattleParticipants($bossInstanceId: ID!) {
    getBossBattleParticipants(bossInstanceId: $bossInstanceId) {
      boss_instance_id
      student_id
      class_id
      guild_id
      state
      joined_at
      updated_at
      last_submit_at
      frozen_until
      is_downed
      downed_at
      kick_reason
    }
  }
`;

export const GET_ACTIVE_BOSS_QUESTION = /* GraphQL */ `
  query GetActiveBossQuestion($questionId: ID!) {
    getActiveBossQuestion(questionId: $questionId) {
      question_id
      boss_template_id
      order_index
      order_key
      question_text
      question_type
      options
      correct_answer
      damage_to_boss_on_correct
      damage_to_guild_on_incorrect
      max_points
      auto_gradable
      time_limit_seconds
      created_at
      updated_at
    }
  }
`;

/**
 * GraphQL subscription strings for the Boss Battle AppSync realtime layer.
 *
 * Phase 2: subscription strings defined; WebSocket connections open successfully.
 * Events will fire in Phase 3 once mutation-resolver.ts calls publishBattleStateChanged
 * / publishRosterChanged via SigV4 HTTP after each successful lifecycle mutation.
 */

/**
 * Subscribes to all state changes for a specific boss battle instance.
 * Filtered by bossInstanceId — only events for this battle are delivered.
 *
 * Triggered by: startBattle, startCountdown, startQuestion, resolveQuestion,
 * advanceQuestion, finishBattle (and submitAnswer when quorum counters change).
 */
export const ON_BATTLE_STATE_CHANGED = /* GraphQL */ `
  subscription OnBattleStateChanged($bossInstanceId: ID!) {
    onBattleStateChanged(bossInstanceId: $bossInstanceId) {
      boss_instance_id
      status
      current_boss_hp
      initial_boss_hp
      active_question_id
      question_started_at
      question_ends_at
      countdown_end_at
      intermission_ends_at
      active_guild_id
      received_answer_count
      required_answer_count
      ready_to_resolve
      per_guild_active_question_id
      outcome
      fail_reason
      completed_at
      updated_at
    }
  }
`;

/**
 * Subscribes to roster changes (join/spectate/leave/kick) for a specific boss battle.
 * Delivers the full participant array on each change (≤35 students — delta not needed).
 */
export const ON_ROSTER_CHANGED = /* GraphQL */ `
  subscription OnRosterChanged($bossInstanceId: ID!) {
    onRosterChanged(bossInstanceId: $bossInstanceId) {
      boss_instance_id
      participants {
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
  }
`;

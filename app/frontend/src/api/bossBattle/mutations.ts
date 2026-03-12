/**
 * GraphQL mutation strings for the Boss Battle AppSync API.
 *
 * Phase 3: all 11 lifecycle mutations wired through the mutation resolver Lambda.
 *
 * Usage notes:
 *   - submitAnswer REST call MUST remain for the synchronous is_correct / frozen_until
 *     feedback. The GraphQL mutation can be used as an alternative path but
 *     the REST response is the authoritative sync signal.
 *   - All other mutations can replace REST calls once Phase 4 frontend migration runs.
 */

import { graphqlClient } from "./graphqlClient.ts";

// ──────────────────────────────────────────────────────────────────────────────
// Teacher lifecycle mutations
// ──────────────────────────────────────────────────────────────────────────────

export const START_BATTLE = /* GraphQL */ `
  mutation StartBattle($bossInstanceId: ID!) {
    startBattle(bossInstanceId: $bossInstanceId) {
      success
      statusCode
      message
      error
    }
  }
`;

export const START_COUNTDOWN = /* GraphQL */ `
  mutation StartCountdown($bossInstanceId: ID!) {
    startCountdown(bossInstanceId: $bossInstanceId) {
      success
      statusCode
      message
      error
    }
  }
`;

export const START_QUESTION = /* GraphQL */ `
  mutation StartQuestion($bossInstanceId: ID!) {
    startQuestion(bossInstanceId: $bossInstanceId) {
      success
      statusCode
      message
      error
    }
  }
`;

export const RESOLVE_QUESTION = /* GraphQL */ `
  mutation ResolveQuestion($bossInstanceId: ID!) {
    resolveQuestion(bossInstanceId: $bossInstanceId) {
      success
      statusCode
      message
      error
    }
  }
`;

export const ADVANCE_QUESTION = /* GraphQL */ `
  mutation AdvanceQuestion($bossInstanceId: ID!) {
    advanceQuestion(bossInstanceId: $bossInstanceId) {
      success
      statusCode
      message
      error
    }
  }
`;

export const FINISH_BATTLE = /* GraphQL */ `
  mutation FinishBattle($bossInstanceId: ID!) {
    finishBattle(bossInstanceId: $bossInstanceId) {
      success
      statusCode
      message
      error
    }
  }
`;

// ──────────────────────────────────────────────────────────────────────────────
// Student mutation — synchronous feedback
// ──────────────────────────────────────────────────────────────────────────────

/**
 * answerRaw must be a JSON-encoded string (AWSJSON), e.g.:
 *   JSON.stringify({ value: "A" })  for MCQ
 *   JSON.stringify({ value: true }) for TRUE_FALSE
 */
export const SUBMIT_ANSWER = /* GraphQL */ `
  mutation SubmitAnswer($bossInstanceId: ID!, $answerRaw: AWSJSON!) {
    submitAnswer(bossInstanceId: $bossInstanceId, answerRaw: $answerRaw) {
      success
      is_correct
      elapsed_seconds
      effective_time_limit_seconds
      speed_multiplier
      damage_to_boss
      hearts_delta_student
      hearts_delta_guild_total
      frozen_until
      received_answer_count
      required_answer_count
      ready_to_resolve
      error
    }
  }
`;

// ──────────────────────────────────────────────────────────────────────────────
// Participant roster mutations
// ──────────────────────────────────────────────────────────────────────────────

export const JOIN_BATTLE = /* GraphQL */ `
  mutation JoinBattle($bossInstanceId: ID!, $guildId: ID!) {
    joinBattle(bossInstanceId: $bossInstanceId, guildId: $guildId) {
      success
      state
      message
      error
    }
  }
`;

export const SPECTATE_BATTLE = /* GraphQL */ `
  mutation SpectateBattle($bossInstanceId: ID!) {
    spectateBattle(bossInstanceId: $bossInstanceId) {
      success
      state
      message
      error
    }
  }
`;

export const LEAVE_BATTLE = /* GraphQL */ `
  mutation LeaveBattle($bossInstanceId: ID!) {
    leaveBattle(bossInstanceId: $bossInstanceId) {
      success
      state
      message
      error
    }
  }
`;

export const KICK_PARTICIPANT = /* GraphQL */ `
  mutation KickParticipant($bossInstanceId: ID!, $studentId: ID!, $reason: String) {
    kickParticipant(bossInstanceId: $bossInstanceId, studentId: $studentId, reason: $reason) {
      success
      message
      error
    }
  }
`;

// ──────────────────────────────────────────────────────────────────────────────
// Typed mutation helpers
// ──────────────────────────────────────────────────────────────────────────────

export interface ActionResult {
    success: boolean;
    statusCode?: number;
    message?: string | null;
    error?: string | null;
}

export interface SubmitAnswerResult {
    success: boolean;
    is_correct?: boolean | null;
    elapsed_seconds?: number | null;
    effective_time_limit_seconds?: number | null;
    speed_multiplier?: number | null;
    damage_to_boss?: number | null;
    hearts_delta_student?: number | null;
    hearts_delta_guild_total?: number | null;
    frozen_until?: string | null;
    received_answer_count?: number | null;
    required_answer_count?: number | null;
    ready_to_resolve?: boolean | null;
    error?: string | null;
}

export interface ParticipantActionResult {
    success: boolean;
    state?: string | null;
    message?: string | null;
    error?: string | null;
}

export async function startBattleGql(bossInstanceId: string): Promise<ActionResult> {
    const result = (await graphqlClient.graphql({ query: START_BATTLE, variables: { bossInstanceId } })) as any;
    return result.data.startBattle;
}

export async function startCountdownGql(bossInstanceId: string): Promise<ActionResult> {
    const result = (await graphqlClient.graphql({ query: START_COUNTDOWN, variables: { bossInstanceId } })) as any;
    return result.data.startCountdown;
}

export async function startQuestionGql(bossInstanceId: string): Promise<ActionResult> {
    const result = (await graphqlClient.graphql({ query: START_QUESTION, variables: { bossInstanceId } })) as any;
    return result.data.startQuestion;
}

export async function resolveQuestionGql(bossInstanceId: string): Promise<ActionResult> {
    const result = (await graphqlClient.graphql({ query: RESOLVE_QUESTION, variables: { bossInstanceId } })) as any;
    return result.data.resolveQuestion;
}

export async function advanceQuestionGql(bossInstanceId: string): Promise<ActionResult> {
    const result = (await graphqlClient.graphql({ query: ADVANCE_QUESTION, variables: { bossInstanceId } })) as any;
    return result.data.advanceQuestion;
}

export async function finishBattleGql(bossInstanceId: string): Promise<ActionResult> {
    const result = (await graphqlClient.graphql({ query: FINISH_BATTLE, variables: { bossInstanceId } })) as any;
    return result.data.finishBattle;
}

export async function submitAnswerGql(
    bossInstanceId: string,
    answerRaw: Record<string, unknown>
): Promise<SubmitAnswerResult> {
    const result = (await graphqlClient.graphql({
        query: SUBMIT_ANSWER,
        variables: { bossInstanceId, answerRaw: JSON.stringify(answerRaw) },
    })) as any;
    return result.data.submitAnswer;
}

export async function joinBattleGql(bossInstanceId: string, guildId: string): Promise<ParticipantActionResult> {
    const result = (await graphqlClient.graphql({ query: JOIN_BATTLE, variables: { bossInstanceId, guildId } })) as any;
    return result.data.joinBattle;
}

export async function spectateBattleGql(bossInstanceId: string): Promise<ParticipantActionResult> {
    const result = (await graphqlClient.graphql({ query: SPECTATE_BATTLE, variables: { bossInstanceId } })) as any;
    return result.data.spectateBattle;
}

export async function leaveBattleGql(bossInstanceId: string): Promise<ParticipantActionResult> {
    const result = (await graphqlClient.graphql({ query: LEAVE_BATTLE, variables: { bossInstanceId } })) as any;
    return result.data.leaveBattle;
}

export async function kickParticipantGql(
    bossInstanceId: string,
    studentId: string,
    reason?: string
): Promise<ParticipantActionResult> {
    const result = (await graphqlClient.graphql({
        query: KICK_PARTICIPANT,
        variables: { bossInstanceId, studentId, reason: reason ?? null },
    })) as any;
    return result.data.kickParticipant;
}

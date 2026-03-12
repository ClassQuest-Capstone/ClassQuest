/**
 * AppSync GraphQL client for ClassQuest Boss Battle realtime layer.
 *
 * Uses Amplify v6 generateClient() which reads from the API.GraphQL config
 * set in aws-exports.ts (populated when VITE_APPSYNC_API_URL is present).
 *
 * Phase 2: exports typed helpers for all 4 MVP queries.
 * Phase 3+: mutation helpers will be added in mutations.ts.
 *
 * Usage:
 *   import { getBossBattleInstanceGql } from "@/api/bossBattle/graphqlClient";
 *   const instance = await getBossBattleInstanceGql("boss-instance-id-here");
 */

import { generateClient } from "aws-amplify/api";
import {
    GET_BOSS_BATTLE_INSTANCE,
    LIST_BOSS_BATTLE_INSTANCES_BY_CLASS,
    GET_BOSS_BATTLE_PARTICIPANTS,
    GET_ACTIVE_BOSS_QUESTION,
} from "./queries.ts";
import type {
    BossBattleInstanceGql,
    BossBattleParticipantGql,
    BossQuestionGql,
} from "./types.ts";

// Singleton Amplify GraphQL client — reads API.GraphQL config from aws-exports.ts
export const graphqlClient = generateClient();

/**
 * Fetch a single BossBattleInstance by ID via the AppSync direct DDB resolver.
 * Returns null if the item does not exist in DynamoDB.
 */
export async function getBossBattleInstanceGql(
    bossInstanceId: string
): Promise<BossBattleInstanceGql | null> {
    const result = (await graphqlClient.graphql({
        query: GET_BOSS_BATTLE_INSTANCE,
        variables: { bossInstanceId },
    })) as any;
    return result.data?.getBossBattleInstance ?? null;
}

/**
 * List all BossBattleInstances for a class via GSI1 query.
 * Returns an empty array if no instances exist.
 */
export async function listBossBattleInstancesByClassGql(
    classId: string
): Promise<BossBattleInstanceGql[]> {
    const result = (await graphqlClient.graphql({
        query: LIST_BOSS_BATTLE_INSTANCES_BY_CLASS,
        variables: { classId },
    })) as any;
    return result.data?.listBossBattleInstancesByClass ?? [];
}

/**
 * List all participants for a boss battle instance.
 * Returns an empty array if no participants exist.
 */
export async function getBossBattleParticipantsGql(
    bossInstanceId: string
): Promise<BossBattleParticipantGql[]> {
    const result = (await graphqlClient.graphql({
        query: GET_BOSS_BATTLE_PARTICIPANTS,
        variables: { bossInstanceId },
    })) as any;
    return result.data?.getBossBattleParticipants ?? [];
}

/**
 * Fetch a single BossQuestion by ID.
 * correct_answer will be null for Students group callers (filtered by resolver).
 * Returns null if the question does not exist.
 */
export async function getActiveBossQuestionGql(
    questionId: string
): Promise<BossQuestionGql | null> {
    const result = (await graphqlClient.graphql({
        query: GET_ACTIVE_BOSS_QUESTION,
        variables: { questionId },
    })) as any;
    return result.data?.getActiveBossQuestion ?? null;
}

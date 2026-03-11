/**
 * AppSync GraphQL client for ClassQuest Boss Battle realtime layer.
 *
 * Uses Amplify v6 generateClient() which reads from the API.GraphQL config
 * set in aws-exports.ts (populated when VITE_APPSYNC_API_URL is present).
 *
 * Phase 1: exports the client + a typed getBossBattleInstance helper.
 * Phase 2+: queries, mutations, and subscription helpers will be added in
 *            separate queries.ts / mutations.ts / subscriptions.ts files.
 *
 * Usage:
 *   import { getBossBattleInstanceGql } from "@/api/bossBattle/graphqlClient";
 *   const instance = await getBossBattleInstanceGql("boss-instance-id-here");
 */

import { generateClient } from "aws-amplify/api";
import { GET_BOSS_BATTLE_INSTANCE } from "./queries.ts";
import type { BossBattleInstanceGql } from "./types.ts";

// Singleton Amplify GraphQL client — reads API.GraphQL config from aws-exports.ts
export const graphqlClient = generateClient();

/**
 * Fetch a single BossBattleInstance by ID via the AppSync direct DDB resolver.
 * Returns null if the item does not exist in DynamoDB.
 */
export async function getBossBattleInstanceGql(
    bossInstanceId: string
): Promise<BossBattleInstanceGql | null> {
    const result = await graphqlClient.graphql({
        query: GET_BOSS_BATTLE_INSTANCE,
        variables: { bossInstanceId },
    });
    return (result.data as any)?.getBossBattleInstance ?? null;
}

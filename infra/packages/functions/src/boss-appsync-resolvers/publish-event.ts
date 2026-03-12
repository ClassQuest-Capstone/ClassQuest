/**
 * publish-event.ts — SigV4-signed AppSync HTTP helper.
 *
 * Called by mutation-resolver.ts AFTER each successful lifecycle mutation to
 * push a subscription event to all connected clients.
 *
 * IMPORTANT: This module must NEVER throw. Publish failures are logged but
 * must NOT roll back the DynamoDB state change that already succeeded.
 *
 * Auth: IAM (@aws_iam). The mutation resolver Lambda's execution role must have
 * appsync:GraphQL permission on the AppSync API ARN.
 */

import { SignatureV4 } from "@smithy/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";

// Populated by AppSyncStack via Lambda environment variables
const APPSYNC_URL = process.env.APPSYNC_API_URL!;
const AWS_REGION  = process.env.AWS_REGION ?? "ca-central-1";

// Lambda always injects AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN.
// Reading lazily (async fn) ensures the session token is fresh on every call.
const signer = new SignatureV4({
    credentials: async () => ({
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken:    process.env.AWS_SESSION_TOKEN,
    }),
    region: AWS_REGION,
    service: "appsync",
    sha256: Sha256,
});

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

export interface BossBattleStateEventPayload {
    boss_instance_id: string;
    status: string;
    current_boss_hp?: number | null;
    initial_boss_hp?: number | null;
    active_question_id?: string | null;
    question_started_at?: string | null;
    question_ends_at?: string | null;
    countdown_end_at?: string | null;
    intermission_ends_at?: string | null;
    active_guild_id?: string | null;
    received_answer_count?: number | null;
    required_answer_count?: number | null;
    ready_to_resolve?: boolean | null;
    per_guild_active_question_id?: Record<string, unknown> | null;
    outcome?: string | null;
    fail_reason?: string | null;
    completed_at?: string | null;
    updated_at?: string | null;
}

export interface BossBattleParticipantPayload {
    boss_instance_id: string;
    student_id: string;
    class_id: string;
    guild_id: string;
    state: string;
    joined_at: string;
    updated_at: string;
    last_submit_at?: string | null;
    frozen_until?: string | null;
    is_downed: boolean;
    downed_at?: string | null;
    kick_reason?: string | null;
}

/**
 * Publish a BossBattleStateEvent subscription to all clients subscribed to
 * onBattleStateChanged(bossInstanceId).
 * Never throws — publish failures are logged only.
 */
export async function publishBattleStateChanged(
    payload: BossBattleStateEventPayload
): Promise<void> {
    const mutation = /* GraphQL */ `
        mutation PublishBattleStateChanged($input: BossBattleStateEventInput!) {
            publishBattleStateChanged(input: $input) {
                boss_instance_id
            }
        }
    `;
    await callAppSync(mutation, { input: payload }).catch((err) => {
        console.error(
            "[publish-event] publishBattleStateChanged failed — subscription event NOT delivered",
            { boss_instance_id: payload.boss_instance_id, err }
        );
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Phase 5: onAnswerSubmitted payload + publisher
// ──────────────────────────────────────────────────────────────────────────────

export interface AnswerSubmittedPayload {
    boss_instance_id: string;
    student_id: string;
    is_correct: boolean;
    received_answer_count?: number | null;
    required_answer_count?: number | null;
    ready_to_resolve?: boolean | null;
    updated_at?: string | null;
}

/**
 * Publish an AnswerSubmittedEvent subscription to all clients subscribed to
 * onAnswerSubmitted(bossInstanceId) — typically the teacher monitor.
 * Never throws — publish failures are logged only.
 */
export async function publishAnswerSubmitted(
    payload: AnswerSubmittedPayload
): Promise<void> {
    const mutation = /* GraphQL */ `
        mutation PublishAnswerSubmitted(
            $bossInstanceId: ID!
            $studentId: ID!
            $isCorrect: Boolean!
            $receivedAnswerCount: Int
            $requiredAnswerCount: Int
            $readyToResolve: Boolean
            $updatedAt: String
        ) {
            publishAnswerSubmitted(
                bossInstanceId: $bossInstanceId
                studentId: $studentId
                isCorrect: $isCorrect
                receivedAnswerCount: $receivedAnswerCount
                requiredAnswerCount: $requiredAnswerCount
                readyToResolve: $readyToResolve
                updatedAt: $updatedAt
            ) {
                boss_instance_id
            }
        }
    `;
    await callAppSync(mutation, {
        bossInstanceId: payload.boss_instance_id,
        studentId:      payload.student_id,
        isCorrect:      payload.is_correct,
        receivedAnswerCount: payload.received_answer_count ?? null,
        requiredAnswerCount: payload.required_answer_count ?? null,
        readyToResolve:      payload.ready_to_resolve ?? null,
        updatedAt:           payload.updated_at ?? null,
    }).catch((err) => {
        console.error(
            "[publish-event] publishAnswerSubmitted failed — subscription event NOT delivered",
            { boss_instance_id: payload.boss_instance_id, student_id: payload.student_id, err }
        );
    });
}

/**
 * Publish a RosterChangedEvent subscription to all clients subscribed to
 * onRosterChanged(bossInstanceId).
 * Never throws — publish failures are logged only.
 */
export async function publishRosterChanged(
    bossInstanceId: string,
    participants: BossBattleParticipantPayload[]
): Promise<void> {
    const mutation = /* GraphQL */ `
        mutation PublishRosterChanged(
            $bossInstanceId: ID!
            $participants: [BossBattleParticipantInput!]!
        ) {
            publishRosterChanged(bossInstanceId: $bossInstanceId, participants: $participants) {
                boss_instance_id
            }
        }
    `;
    await callAppSync(mutation, { bossInstanceId, participants }).catch((err) => {
        console.error(
            "[publish-event] publishRosterChanged failed — subscription event NOT delivered",
            { bossInstanceId, err }
        );
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// SigV4-signed AppSync HTTP call
// ──────────────────────────────────────────────────────────────────────────────

async function callAppSync(
    query: string,
    variables: Record<string, unknown>
): Promise<void> {
    if (!APPSYNC_URL) {
        console.error("[publish-event] APPSYNC_API_URL env var is not set — skipping publish");
        return;
    }

    const url = new URL(APPSYNC_URL);
    const body = JSON.stringify({ query, variables });

    // Build the request to sign
    const requestToSign = {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname,
        headers: {
            "Content-Type": "application/json",
            host: url.hostname,
        },
        body,
    };

    // Sign with SigV4
    const signedRequest = await signer.sign(requestToSign);

    // Execute with native fetch (Node 18+)
    const response = await fetch(APPSYNC_URL, {
        method: "POST",
        headers: signedRequest.headers as Record<string, string>,
        body,
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "(unreadable)");
        throw new Error(`AppSync HTTP ${response.status}: ${text}`);
    }

    const json = (await response.json()) as { errors?: unknown[] };
    if (json.errors?.length) {
        throw new Error(`AppSync GraphQL errors: ${JSON.stringify(json.errors)}`);
    }
}

/**
 * useBattleSubscription — React hooks for AppSync boss battle realtime subscriptions.
 *
 * Phase 2: onBattleStateChanged + onRosterChanged.
 * Phase 5:
 *   - Exponential backoff reconnection (1s → 2s → 4s → … → 30s cap).
 *   - "reconnecting" connectionStatus exposed so UI can show a warning banner.
 *   - useAnswerSubmittedSubscription added for teacher monitor quorum tracking.
 */

import { useEffect, useRef, useState } from "react";
import { graphqlClient } from "../api/bossBattle/graphqlClient.ts";
import {
    ON_BATTLE_STATE_CHANGED,
    ON_ROSTER_CHANGED,
    ON_ANSWER_SUBMITTED,
} from "../api/bossBattle/subscriptions.ts";
import type {
    BossBattleStateEvent,
    RosterChangedEvent,
    AnswerSubmittedEvent,
} from "../api/bossBattle/types.ts";

export type SubscriptionStatus = "connecting" | "connected" | "reconnecting" | "error" | "closed";

// Maximum reconnect delay in milliseconds (30 s)
const MAX_RECONNECT_DELAY_MS = 30_000;

function calcBackoffDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), MAX_RECONNECT_DELAY_MS);
}

// ──────────────────────────────────────────────────────────────────────────────
// useBattleSubscription
// Subscribes to onBattleStateChanged for a specific boss battle instance.
// Reconnects with exponential backoff on error.
// ──────────────────────────────────────────────────────────────────────────────

export function useBattleSubscription(bossInstanceId: string | null | undefined) {
    const [battleState, setBattleState] = useState<BossBattleStateEvent | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<SubscriptionStatus>("connecting");
    const subRef = useRef<{ unsubscribe: () => void } | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);
    // Incrementing this counter triggers the effect to re-subscribe after a backoff delay.
    const [reconnectTick, setReconnectTick] = useState(0);

    useEffect(() => {
        if (!bossInstanceId) return;

        // Cancel any pending backoff timer from a previous cycle
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }

        let cancelled = false;
        setConnectionStatus("connecting");

        const observable = graphqlClient.graphql({
            query: ON_BATTLE_STATE_CHANGED,
            variables: { bossInstanceId },
        }) as any;

        subRef.current = observable.subscribe({
            next: ({ data }: { data: any }) => {
                const event: BossBattleStateEvent = data?.onBattleStateChanged;
                if (event) {
                    reconnectAttemptRef.current = 0; // reset backoff on successful message
                    setConnectionStatus("connected");
                    setBattleState(event);
                }
            },
            error: (err: unknown) => {
                if (cancelled) return;
                console.error("[useBattleSubscription] error — scheduling reconnect", err);
                const delay = calcBackoffDelay(reconnectAttemptRef.current);
                reconnectAttemptRef.current += 1;
                setConnectionStatus("reconnecting");
                reconnectTimerRef.current = setTimeout(() => {
                    if (!cancelled) setReconnectTick((t) => t + 1);
                }, delay);
            },
            complete: () => {
                if (!cancelled) setConnectionStatus("closed");
            },
        });

        // Mark connected immediately after subscribe call succeeds
        setConnectionStatus("connected");

        return () => {
            cancelled = true;
            subRef.current?.unsubscribe();
            subRef.current = null;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };
    }, [bossInstanceId, reconnectTick]);

    return { battleState, connectionStatus };
}

// ──────────────────────────────────────────────────────────────────────────────
// useRosterSubscription
// Subscribes to onRosterChanged for a specific boss battle instance.
// Each event replaces the full participant list — no delta merging needed.
// ──────────────────────────────────────────────────────────────────────────────

export function useRosterSubscription(bossInstanceId: string | null | undefined) {
    const [rosterEvent, setRosterEvent] = useState<RosterChangedEvent | null>(null);
    const [rosterConnectionStatus, setRosterConnectionStatus] =
        useState<SubscriptionStatus>("connecting");
    const subRef = useRef<{ unsubscribe: () => void } | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);
    const [reconnectTick, setReconnectTick] = useState(0);

    useEffect(() => {
        if (!bossInstanceId) return;

        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }

        let cancelled = false;
        setRosterConnectionStatus("connecting");

        const observable = graphqlClient.graphql({
            query: ON_ROSTER_CHANGED,
            variables: { bossInstanceId },
        }) as any;

        subRef.current = observable.subscribe({
            next: ({ data }: { data: any }) => {
                const event: RosterChangedEvent = data?.onRosterChanged;
                if (event) {
                    reconnectAttemptRef.current = 0;
                    setRosterConnectionStatus("connected");
                    setRosterEvent(event);
                }
            },
            error: (err: unknown) => {
                if (cancelled) return;
                console.error("[useRosterSubscription] error — scheduling reconnect", err);
                const delay = calcBackoffDelay(reconnectAttemptRef.current);
                reconnectAttemptRef.current += 1;
                setRosterConnectionStatus("reconnecting");
                reconnectTimerRef.current = setTimeout(() => {
                    if (!cancelled) setReconnectTick((t) => t + 1);
                }, delay);
            },
            complete: () => {
                if (!cancelled) setRosterConnectionStatus("closed");
            },
        });

        setRosterConnectionStatus("connected");

        return () => {
            cancelled = true;
            subRef.current?.unsubscribe();
            subRef.current = null;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };
    }, [bossInstanceId, reconnectTick]);

    return { rosterEvent, rosterConnectionStatus };
}

// ──────────────────────────────────────────────────────────────────────────────
// useAnswerSubmittedSubscription  (Phase 5)
// Subscribes to onAnswerSubmitted for a specific boss battle instance.
// Primarily used by the teacher monitor for live per-student answer feedback.
// ──────────────────────────────────────────────────────────────────────────────

export function useAnswerSubmittedSubscription(bossInstanceId: string | null | undefined) {
    const [answerEvent, setAnswerEvent] = useState<AnswerSubmittedEvent | null>(null);
    const [answerConnectionStatus, setAnswerConnectionStatus] =
        useState<SubscriptionStatus>("connecting");
    const subRef = useRef<{ unsubscribe: () => void } | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);
    const [reconnectTick, setReconnectTick] = useState(0);

    useEffect(() => {
        if (!bossInstanceId) return;

        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }

        let cancelled = false;
        setAnswerConnectionStatus("connecting");

        const observable = graphqlClient.graphql({
            query: ON_ANSWER_SUBMITTED,
            variables: { bossInstanceId },
        }) as any;

        subRef.current = observable.subscribe({
            next: ({ data }: { data: any }) => {
                const event: AnswerSubmittedEvent = data?.onAnswerSubmitted;
                if (event) {
                    reconnectAttemptRef.current = 0;
                    setAnswerConnectionStatus("connected");
                    setAnswerEvent(event);
                }
            },
            error: (err: unknown) => {
                if (cancelled) return;
                console.error("[useAnswerSubmittedSubscription] error — scheduling reconnect", err);
                const delay = calcBackoffDelay(reconnectAttemptRef.current);
                reconnectAttemptRef.current += 1;
                setAnswerConnectionStatus("reconnecting");
                reconnectTimerRef.current = setTimeout(() => {
                    if (!cancelled) setReconnectTick((t) => t + 1);
                }, delay);
            },
            complete: () => {
                if (!cancelled) setAnswerConnectionStatus("closed");
            },
        });

        setAnswerConnectionStatus("connected");

        return () => {
            cancelled = true;
            subRef.current?.unsubscribe();
            subRef.current = null;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
        };
    }, [bossInstanceId, reconnectTick]);

    return { answerEvent, answerConnectionStatus };
}

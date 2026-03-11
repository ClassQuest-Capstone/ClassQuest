/**
 * useBattleSubscription — React hook for AppSync boss battle realtime subscriptions.
 *
 * Phase 2: establishes WebSocket connections; exposes connectionStatus.
 * Events arrive after Phase 3 wires the mutation resolver Lambda.
 *
 * Usage:
 *   const { battleState, connectionStatus } = useBattleSubscription(bossInstanceId);
 *   const { rosterEvent, rosterConnectionStatus } = useRosterSubscription(bossInstanceId);
 */

import { useEffect, useRef, useState } from "react";
import { graphqlClient } from "../api/bossBattle/graphqlClient.ts";
import {
    ON_BATTLE_STATE_CHANGED,
    ON_ROSTER_CHANGED,
} from "../api/bossBattle/subscriptions.ts";
import type { BossBattleStateEvent, RosterChangedEvent } from "../api/bossBattle/types.ts";

export type SubscriptionStatus = "connecting" | "connected" | "error" | "closed";

// ──────────────────────────────────────────────────────────────────────────────
// useBattleSubscription
// Subscribes to onBattleStateChanged for a specific boss battle instance.
// Merges incoming events into local state; callers read battleState to get the
// latest snapshot without polling.
// ──────────────────────────────────────────────────────────────────────────────

export function useBattleSubscription(bossInstanceId: string | null | undefined) {
    const [battleState, setBattleState] = useState<BossBattleStateEvent | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<SubscriptionStatus>("connecting");
    const subRef = useRef<{ unsubscribe: () => void } | null>(null);

    useEffect(() => {
        if (!bossInstanceId) return;

        setConnectionStatus("connecting");

        const observable = graphqlClient.graphql({
            query: ON_BATTLE_STATE_CHANGED,
            variables: { bossInstanceId },
        }) as any;

        subRef.current = observable.subscribe({
            next: ({ data }: { data: any }) => {
                const event: BossBattleStateEvent = data?.onBattleStateChanged;
                if (event) {
                    setConnectionStatus("connected");
                    setBattleState(event);
                }
            },
            error: (err: unknown) => {
                console.error("[useBattleSubscription] error", err);
                setConnectionStatus("error");
            },
            complete: () => {
                setConnectionStatus("closed");
            },
        });

        // Mark connected immediately after subscribe succeeds (before first event)
        setConnectionStatus("connected");

        return () => {
            subRef.current?.unsubscribe();
            subRef.current = null;
            setConnectionStatus("closed");
        };
    }, [bossInstanceId]);

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

    useEffect(() => {
        if (!bossInstanceId) return;

        setRosterConnectionStatus("connecting");

        const observable = graphqlClient.graphql({
            query: ON_ROSTER_CHANGED,
            variables: { bossInstanceId },
        }) as any;

        subRef.current = observable.subscribe({
            next: ({ data }: { data: any }) => {
                const event: RosterChangedEvent = data?.onRosterChanged;
                if (event) {
                    setRosterConnectionStatus("connected");
                    setRosterEvent(event);
                }
            },
            error: (err: unknown) => {
                console.error("[useRosterSubscription] error", err);
                setRosterConnectionStatus("error");
            },
            complete: () => {
                setRosterConnectionStatus("closed");
            },
        });

        setRosterConnectionStatus("connected");

        return () => {
            subRef.current?.unsubscribe();
            subRef.current = null;
            setRosterConnectionStatus("closed");
        };
    }, [bossInstanceId]);

    return { rosterEvent, rosterConnectionStatus };
}

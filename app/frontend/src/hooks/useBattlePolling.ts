/**
 * useBattlePolling — REST-based polling hooks for Boss Battle real-time state.
 *
 * Replaces AppSync subscriptions with simple interval polling so that
 * all state transitions are visible without WebSocket auth complexity.
 *
 * Polling intervals:
 *   - Instance state: 2.5 s (fast enough to feel real-time)
 *   - Roster:         3 s
 */

import { useEffect, useRef, useState } from "react";
import { getBossBattleInstance } from "../api/bossBattleInstances/client.js";
import { listBossBattleParticipants } from "../api/bossBattleParticipants/client.js";
import type { BossBattleInstance } from "../api/bossBattleInstances/types.js";
import type { BossBattleParticipant } from "../api/bossBattleParticipants/types.js";

// ──────────────────────────────────────────────────────────────────────────────
// useBattlePolling
// Polls getBossBattleInstance every intervalMs ms.
// Returns the latest instance (null until first successful poll).
// ──────────────────────────────────────────────────────────────────────────────

export function useBattlePolling(
    bossInstanceId: string | null | undefined,
    intervalMs = 2500
): BossBattleInstance | null {
    const [instance, setInstance] = useState<BossBattleInstance | null>(null);
    const activeRef = useRef(true);

    useEffect(() => {
        if (!bossInstanceId) return;
        activeRef.current = true;

        async function poll() {
            try {
                const data = await getBossBattleInstance(bossInstanceId!);
                if (activeRef.current) setInstance(data);
            } catch {
                // Silently ignore transient network errors
            }
        }

        poll();
        const timer = setInterval(poll, intervalMs);

        return () => {
            activeRef.current = false;
            clearInterval(timer);
        };
    }, [bossInstanceId, intervalMs]);

    return instance;
}

// ──────────────────────────────────────────────────────────────────────────────
// useRosterPolling
// Polls listBossBattleParticipants every intervalMs ms.
// Returns the latest participant list (empty until first successful poll).
// ──────────────────────────────────────────────────────────────────────────────

export function useRosterPolling(
    bossInstanceId: string | null | undefined,
    intervalMs = 3000
): BossBattleParticipant[] {
    const [participants, setParticipants] = useState<BossBattleParticipant[]>([]);
    const activeRef = useRef(true);

    useEffect(() => {
        if (!bossInstanceId) return;
        activeRef.current = true;

        async function poll() {
            try {
                const res = await listBossBattleParticipants(bossInstanceId!);
                if (activeRef.current) setParticipants(res.items || []);
            } catch {
                // Silently ignore transient network errors
            }
        }

        poll();
        const timer = setInterval(poll, intervalMs);

        return () => {
            activeRef.current = false;
            clearInterval(timer);
        };
    }, [bossInstanceId, intervalMs]);

    return participants;
}

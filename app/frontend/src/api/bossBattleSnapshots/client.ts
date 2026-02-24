import { api } from "../http.js";
import type { BossBattleSnapshot, CreateSnapshotInput } from "./types.js";

/**
 * Create participants snapshot
 * POST /boss-battle-instances/{boss_instance_id}/snapshots/participants
 */
export function createParticipantsSnapshot(
    bossInstanceId: string,
    input: CreateSnapshotInput
) {
    return api<{
        message: string;
        snapshot_id: string;
        created_at: string;
    }>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/snapshots/participants`,
        {
            method: "POST",
            body: JSON.stringify(input),
        }
    );
}

/**
 * Get snapshot by ID
 * GET /boss-battle-snapshots/{snapshot_id}
 */
export function getBossBattleSnapshot(snapshotId: string) {
    return api<BossBattleSnapshot>(
        `/boss-battle-snapshots/${encodeURIComponent(snapshotId)}`
    );
}

/**
 * BossBattleSnapshots type definitions
 * Immutable participation snapshots taken at key moments
 */

// Participant entry in snapshot
export type SnapshotParticipant = {
    student_id: string;
    guild_id: string;
    display_name?: string;       // Optional - only if privacy allows
    username?: string;           // Optional - only if privacy allows
};

// Snapshot item structure
export type BossBattleSnapshot = {
    // Primary key
    snapshot_id: string;         // ULID/UUID

    // Identifiers
    boss_instance_id: string;
    class_id: string;
    created_by_teacher_id: string;
    created_at: string;          // ISO timestamp

    // Snapshot payload
    joined_students: SnapshotParticipant[];
    joined_count: number;        // Must match joined_students.length
    guild_counts: Record<string, number>;  // guild_id -> count

    // Metadata
    version: number;             // Start at 1 for future evolution

    // Optional
    participants_hash?: string;  // For change detection / idempotency
};

// Input for creating snapshot
export type CreateSnapshotInput = {
    boss_instance_id: string;
    created_by_teacher_id: string;
};

// Paginated list response
export type PaginatedSnapshots = {
    items: BossBattleSnapshot[];
    nextToken?: string;
};

/**
 * Boss Battle Snapshots type definitions
 */

export type BossBattleSnapshot = {
    snapshot_id: string; // PK: ULID/UUID
    boss_instance_id: string;
    class_id: string;
    snapshot_type: "PARTICIPANTS";
    created_by_teacher_id: string;
    created_at: string; // ISO timestamp
    joined_students: string[]; // List of student IDs
    joined_count: number;
    guild_counts: Record<string, number>; // guild_id -> count
    version: number;
};

export type CreateSnapshotInput = {
    boss_instance_id: string;
};

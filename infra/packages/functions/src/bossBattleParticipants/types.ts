/**
 * BossBattleParticipants type definitions
 */

// State enum for participant status
export enum ParticipantState {
    JOINED = "JOINED",
    SPECTATE = "SPECTATE",
    KICKED = "KICKED",
    LEFT = "LEFT",
}

// DynamoDB item structure
export type BossBattleParticipantItem = {
    // Primary key
    boss_instance_id: string;          // PK
    student_id: string;                // SK

    // Core fields
    class_id: string;                  // Denormalized for auth + GSI2
    guild_id: string;                  // Guild context at join time
    state: ParticipantState;           // Current participation state
    joined_at: string;                 // ISO 8601 timestamp (first join)
    updated_at: string;                // ISO 8601 timestamp (last update)

    // Anti-spam / gameplay flags
    last_submit_at?: string;           // ISO 8601 timestamp of last submission
    frozen_until?: string;             // ISO 8601 timestamp when freeze expires
    is_downed: boolean;                // Default false
    downed_at?: string;                // ISO 8601 timestamp when downed
    kick_reason?: string;              // Reason for kick (if state = KICKED)

    // GSI keys
    gsi2_sk: string;                   // boss_instance_id#student_id for GSI2
};

// Input for joining a battle
export type JoinParticipantInput = {
    boss_instance_id: string;
    student_id: string;
    class_id: string;
    guild_id: string;
};

// Input for updating anti-spam fields
export type UpdateAntiSpamFieldsInput = {
    last_submit_at?: string;
    frozen_until?: string;
};

// Filter for listing participants
export type ListParticipantsFilter = {
    state?: ParticipantState;
};

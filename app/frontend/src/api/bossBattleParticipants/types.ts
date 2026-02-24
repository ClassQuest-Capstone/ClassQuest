/**
 * BossBattleParticipants type definitions
 */

export type ParticipantState = "JOINED" | "SPECTATE" | "KICKED" | "LEFT";

export type BossBattleParticipant = {
    boss_instance_id: string;
    student_id: string;
    class_id: string;
    guild_id: string;
    state: ParticipantState;
    joined_at: string;
    updated_at: string;
    last_submit_at?: string;
    frozen_until?: string;
    is_downed: boolean;
    downed_at?: string;
    kick_reason?: string;
    gsi2_sk: string;
};

export type JoinParticipantInput = {
    guild_id: string;
};

export type KickParticipantInput = {
    reason?: string;
};

export type ParticipantsListResponse = {
    items: BossBattleParticipant[];
    count: number;
};

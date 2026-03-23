import { api } from "../http.js";
import type {
    PlayerAvatar,
    CreatePlayerAvatarInput,
    UpdatePlayerAvatarInput,
    EquipItemInput,
    UnequipItemInput,
    PaginatedPlayerAvatars,
} from "./types.js";

/**
 * Create a new PlayerAvatar state record for a student in a class.
 * POST /player-avatars
 */
export function createPlayerAvatar(input: CreatePlayerAvatarInput) {
    return api<{ message: string; player_avatar_id: string; student_id: string; class_id: string }>(
        "/player-avatars",
        { method: "POST", body: JSON.stringify(input) }
    );
}

/**
 * Get a PlayerAvatar by id.
 * GET /player-avatars/{player_avatar_id}
 */
export function getPlayerAvatar(playerAvatarId: string) {
    return api<PlayerAvatar>(`/player-avatars/${encodeURIComponent(playerAvatarId)}`);
}

/**
 * Get the PlayerAvatar for a specific student in a class.
 * GET /player-avatars/class/{class_id}/student/{student_id}
 */
export function getPlayerAvatarByClassAndStudent(classId: string, studentId: string) {
    return api<PlayerAvatar>(
        `/player-avatars/class/${encodeURIComponent(classId)}/student/${encodeURIComponent(studentId)}`
    );
}

/**
 * List all PlayerAvatars in a class.
 * GET /player-avatars/class/{class_id}
 */
export function listPlayerAvatarsByClass(
    classId: string,
    options?: { limit?: number; cursor?: string }
) {
    const params = new URLSearchParams();
    if (options?.limit)  params.append("limit",  options.limit.toString());
    if (options?.cursor) params.append("cursor",  options.cursor);

    const qs = params.toString();
    return api<PaginatedPlayerAvatars>(
        `/player-avatars/class/${encodeURIComponent(classId)}${qs ? `?${qs}` : ""}`
    );
}

/**
 * Update mutable fields on a PlayerAvatar.
 * PATCH /player-avatars/{player_avatar_id}
 */
export function updatePlayerAvatar(playerAvatarId: string, input: UpdatePlayerAvatarInput) {
    return api<PlayerAvatar>(
        `/player-avatars/${encodeURIComponent(playerAvatarId)}`,
        { method: "PATCH", body: JSON.stringify(input) }
    );
}

/**
 * Equip an item in a specific gear slot (validates ownership and item metadata).
 * POST /player-avatars/{player_avatar_id}/equip
 */
export function equipPlayerAvatarItem(playerAvatarId: string, input: EquipItemInput) {
    return api<PlayerAvatar>(
        `/player-avatars/${encodeURIComponent(playerAvatarId)}/equip`,
        { method: "POST", body: JSON.stringify(input) }
    );
}

/**
 * Unequip a gear slot (resets to AvatarBases default if available).
 * POST /player-avatars/{player_avatar_id}/unequip
 */
export function unequipPlayerAvatarItem(playerAvatarId: string, input: UnequipItemInput) {
    return api<PlayerAvatar & { unequipped_slot: string; reset_to: string | null }>(
        `/player-avatars/${encodeURIComponent(playerAvatarId)}/unequip`,
        { method: "POST", body: JSON.stringify(input) }
    );
}

import { api } from "../http.js";
import type {
    AvatarBase,
    CreateAvatarBaseInput,
    UpdateAvatarBaseInput,
    PaginatedAvatarBases,
    ListAvatarBasesOptions,
} from "./types.js";

/**
 * Create a new avatar base definition (admin/system)
 * POST /avatar-bases
 */
export function createAvatarBase(input: CreateAvatarBaseInput) {
    return api<{ message: string; avatar_base_id: string }>("/avatar-bases", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/**
 * Get a single avatar base by ID
 * GET /avatar-bases/{avatar_base_id}
 */
export function getAvatarBase(avatarBaseId: string) {
    return api<AvatarBase>(`/avatar-bases/${encodeURIComponent(avatarBaseId)}`);
}

/**
 * List avatar bases — optionally filter by gender
 * GET /avatar-bases
 */
export function listAvatarBases(options?: ListAvatarBasesOptions) {
    const params = new URLSearchParams();
    if (options?.limit)  params.append("limit",  options.limit.toString());
    if (options?.cursor) params.append("cursor",  options.cursor);
    if (options?.gender) params.append("gender",  options.gender);

    const qs = params.toString();
    return api<PaginatedAvatarBases>(`/avatar-bases${qs ? `?${qs}` : ""}`);
}

/**
 * Update mutable fields on an avatar base
 * PATCH /avatar-bases/{avatar_base_id}
 */
export function updateAvatarBase(avatarBaseId: string, input: UpdateAvatarBaseInput) {
    return api<AvatarBase>(
        `/avatar-bases/${encodeURIComponent(avatarBaseId)}`,
        {
            method: "PATCH",
            body: JSON.stringify(input),
        }
    );
}

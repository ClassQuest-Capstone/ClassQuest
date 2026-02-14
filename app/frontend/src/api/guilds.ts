import { api } from "./http.js";

export type Guild = {
    guild_id: string;
    class_id: string;
    name: string;
    is_active: boolean;
    gsi1sk: string;
    created_at: string;
    updated_at: string;
};

export type CreateGuildInput = {
    name: string;
};

export type UpdateGuildInput = {
    name?: string;
    is_active?: boolean;
};

export type GuildsListResponse = {
    items: Guild[];
    nextCursor?: string;
    hasMore: boolean;
};

/**
 * Create a new guild in a class
 */
export function createGuild(class_id: string, input: CreateGuildInput) {
    return api<{ ok: true; guild_id: string }>(
        `/classes/${encodeURIComponent(class_id)}/guilds`,
        {
            method: "POST",
            body: JSON.stringify(input),
        }
    );
}

/**
 * Get a guild by ID
 */
export function getGuild(guild_id: string) {
    return api<Guild>(`/guilds/${encodeURIComponent(guild_id)}`);
}

/**
 * List guilds in a class with pagination
 * @param class_id - Class identifier
 * @param limit - Number of results to return (default: 50, max: 100)
 * @param cursor - Pagination cursor from previous response
 */
export function listGuildsByClass(class_id: string, limit?: number, cursor?: string) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", limit.toString());
    if (cursor) params.set("cursor", cursor);

    const query = params.toString() ? `?${params.toString()}` : "";
    return api<GuildsListResponse>(
        `/classes/${encodeURIComponent(class_id)}/guilds${query}`
    );
}

/**
 * Update a guild (name and/or is_active)
 */
export function updateGuild(guild_id: string, input: UpdateGuildInput) {
    return api<Guild>(`/guilds/${encodeURIComponent(guild_id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/**
 * Deactivate a guild (set is_active = false)
 */
export function deactivateGuild(guild_id: string) {
    return api<Guild>(`/guilds/${encodeURIComponent(guild_id)}/deactivate`, {
        method: "PATCH",
    });
}

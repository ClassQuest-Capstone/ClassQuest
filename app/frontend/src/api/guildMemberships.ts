import { api } from "./http.js";

export type RoleInGuild = "LEADER" | "MEMBER";

export type GuildMembership = {
    class_id: string;
    student_id: string;
    guild_id: string;
    role_in_guild: RoleInGuild;
    joined_at: string;
    left_at?: string;
    is_active: boolean;
    updated_at: string;
    gsi1sk: string;
    gsi2sk: string;
};

export type UpsertGuildMembershipInput = {
    guild_id: string;
    role_in_guild?: RoleInGuild;
};

export type GuildMembershipsListResponse = {
    items: GuildMembership[];
    nextCursor?: string;
    hasMore: boolean;
};

/**
 * Upsert a guild membership (create, update role, or change guild)
 *
 * Behavior:
 * - If no membership exists: Creates new membership
 * - If membership exists with same guild_id: Updates role if provided
 * - If membership exists with different guild_id: Changes guild (resets joined_at)
 *
 * @param class_id - Class identifier
 * @param student_id - Student identifier
 * @param input - Guild ID and optional role (defaults to "MEMBER")
 */
export function upsertGuildMembership(
    class_id: string,
    student_id: string,
    input: UpsertGuildMembershipInput
) {
    return api<GuildMembership>(
        `/classes/${encodeURIComponent(class_id)}/guild-memberships/${encodeURIComponent(student_id)}`,
        {
            method: "PUT",
            body: JSON.stringify(input),
        }
    );
}

/**
 * Get a student's guild membership in a specific class
 *
 * @param class_id - Class identifier
 * @param student_id - Student identifier
 * @returns The guild membership if it exists, 404 error otherwise
 */
export function getGuildMembership(class_id: string, student_id: string) {
    return api<GuildMembership>(
        `/classes/${encodeURIComponent(class_id)}/guild-memberships/${encodeURIComponent(student_id)}`
    );
}

/**
 * List all members in a guild (roster) with pagination
 *
 * @param guild_id - Guild identifier
 * @param limit - Number of results to return (default: 50, max: 100)
 * @param cursor - Pagination cursor from previous response
 */
export function listGuildMembers(guild_id: string, limit?: number, cursor?: string) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", limit.toString());
    if (cursor) params.set("cursor", cursor);

    const query = params.toString() ? `?${params.toString()}` : "";
    return api<GuildMembershipsListResponse>(
        `/guilds/${encodeURIComponent(guild_id)}/members${query}`
    );
}

/**
 * List a student's guild membership history across all classes
 *
 * @param student_id - Student identifier
 * @param limit - Number of results to return (default: 50, max: 100)
 * @param cursor - Pagination cursor from previous response
 */
export function listStudentMemberships(student_id: string, limit?: number, cursor?: string) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", limit.toString());
    if (cursor) params.set("cursor", cursor);

    const query = params.toString() ? `?${params.toString()}` : "";
    return api<GuildMembershipsListResponse>(
        `/students/${encodeURIComponent(student_id)}/guild-memberships${query}`
    );
}

/**
 * Leave a guild (sets is_active=false, records left_at timestamp)
 *
 * @param class_id - Class identifier
 * @param student_id - Student identifier
 * @returns Updated membership with is_active=false
 */
export function leaveGuild(class_id: string, student_id: string) {
    return api<GuildMembership>(
        `/classes/${encodeURIComponent(class_id)}/guild-memberships/${encodeURIComponent(student_id)}/leave`,
        {
            method: "PATCH",
        }
    );
}

/**
 * Join a guild (convenience wrapper around upsert)
 *
 * @param class_id - Class identifier
 * @param student_id - Student identifier
 * @param guild_id - Guild to join
 * @param role - Role in guild (defaults to "MEMBER")
 */
export function joinGuild(
    class_id: string,
    student_id: string,
    guild_id: string,
    role: RoleInGuild = "MEMBER"
) {
    return upsertGuildMembership(class_id, student_id, {
        guild_id,
        role_in_guild: role,
    });
}

/**
 * Change guild (convenience wrapper around upsert with different guild_id)
 *
 * @param class_id - Class identifier
 * @param student_id - Student identifier
 * @param new_guild_id - New guild to join
 * @param role - Role in new guild (defaults to "MEMBER")
 */
export function changeGuild(
    class_id: string,
    student_id: string,
    new_guild_id: string,
    role: RoleInGuild = "MEMBER"
) {
    return upsertGuildMembership(class_id, student_id, {
        guild_id: new_guild_id,
        role_in_guild: role,
    });
}

/**
 * Promote to leader (convenience wrapper around upsert with same guild, role=LEADER)
 *
 * @param class_id - Class identifier
 * @param student_id - Student identifier
 * @param guild_id - Current guild ID
 */
export function promoteToLeader(class_id: string, student_id: string, guild_id: string) {
    return upsertGuildMembership(class_id, student_id, {
        guild_id,
        role_in_guild: "LEADER",
    });
}

/**
 * Demote to member (convenience wrapper around upsert with same guild, role=MEMBER)
 *
 * @param class_id - Class identifier
 * @param student_id - Student identifier
 * @param guild_id - Current guild ID
 */
export function demoteToMember(class_id: string, student_id: string, guild_id: string) {
    return upsertGuildMembership(class_id, student_id, {
        guild_id,
        role_in_guild: "MEMBER",
    });
}

import type { RoleInGuild } from "./types.js";

export type ValidationError = {
    field: string;
    error: string;
};

/**
 * Validate guild_id
 */
export function validateGuildId(guild_id: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (guild_id === undefined || guild_id === null) {
        errors.push({ field: "guild_id", error: "required" });
        return errors;
    }

    if (typeof guild_id !== "string") {
        errors.push({ field: "guild_id", error: "must be a string" });
        return errors;
    }

    if (guild_id.trim().length === 0) {
        errors.push({ field: "guild_id", error: "cannot be empty" });
    }

    return errors;
}

/**
 * Validate role_in_guild
 */
export function validateRole(role_in_guild: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (role_in_guild === undefined || role_in_guild === null) {
        // Optional, will default to MEMBER
        return errors;
    }

    if (typeof role_in_guild !== "string") {
        errors.push({ field: "role_in_guild", error: "must be a string" });
        return errors;
    }

    const validRoles: RoleInGuild[] = ["LEADER", "MEMBER"];
    if (!validRoles.includes(role_in_guild as RoleInGuild)) {
        errors.push({
            field: "role_in_guild",
            error: `must be one of: ${validRoles.join(", ")}`,
        });
    }

    return errors;
}

/**
 * Validate upsert membership input
 */
export function validateUpsertMembership(data: any): ValidationError[] {
    const errors: ValidationError[] = [];

    errors.push(...validateGuildId(data.guild_id));
    errors.push(...validateRole(data.role_in_guild));

    return errors;
}

export type RoleInGuild = "LEADER" | "MEMBER";

export type GuildMembershipItem = {
    class_id: string;
    student_id: string;
    guild_id: string;
    role_in_guild: RoleInGuild;
    joined_at: string;
    left_at?: string;
    is_active: boolean;
    updated_at: string;
    gsi1sk: string;  // computed: joined_at#student_id
    gsi2sk: string;  // computed: joined_at#class_id#guild_id
};

export type GuildItem = {
    guild_id: string;
    class_id: string;
    name: string;
    is_active: boolean;
    gsi1sk: string;  // computed: created_at#guild_id
    created_at: string;
    updated_at: string;
};

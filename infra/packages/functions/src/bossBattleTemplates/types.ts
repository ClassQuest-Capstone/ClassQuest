/**
 * Boss battle template item stored in DynamoDB
 */
export type BossBattleTemplateItem = {
    boss_template_id: string;           // UUID - Primary Key
    owner_teacher_id: string;           // Teacher who created this template (GSI1 PK)
    title: string;                      // Template title
    description: string;                // Template description
    subject?: string;                   // Subject area (e.g., "MATH", "SCIENCE")
    max_hp: number;                     // Boss maximum health points
    base_xp_reward: number;             // XP reward for defeating boss
    base_gold_reward: number;           // Gold reward for defeating boss
    is_shared_publicly: boolean;        // Whether template is shared in public library
    public_sort: string;                // Derived sort key: subject#created_at#id (GSI2 SK)
    created_at: string;                 // ISO timestamp
    updated_at: string;                 // ISO timestamp
};

export type CreateBossBattleTemplateInput = Omit<
    BossBattleTemplateItem,
    "boss_template_id" | "public_sort" | "created_at" | "updated_at"
>;

export type UpdateBossBattleTemplateInput = Partial<
    Pick<
        BossBattleTemplateItem,
        | "title"
        | "description"
        | "subject"
        | "max_hp"
        | "base_xp_reward"
        | "base_gold_reward"
        | "is_shared_publicly"
    >
>;

/**
 * Boss battle template type definitions
 */

export type BossBattleTemplate = {
    boss_template_id: string;
    owner_teacher_id: string;
    title: string;
    description: string;
    subject?: string;
    max_hp: number;
    base_xp_reward: number;
    base_gold_reward: number;
    is_shared_publicly: boolean;
    public_sort: string;
    created_at: string;
    updated_at: string;
};

export type CreateBossBattleTemplateInput = {
    owner_teacher_id: string;
    title: string;
    description: string;
    subject?: string;
    max_hp: number;
    base_xp_reward: number;
    base_gold_reward: number;
    is_shared_publicly: boolean;
};

export type UpdateBossBattleTemplateInput = Partial<
    Omit<CreateBossBattleTemplateInput, "owner_teacher_id">
>;

export type PaginatedBossBattleTemplates = {
    items: BossBattleTemplate[];
    cursor?: string;
};

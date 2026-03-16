import type { RewardType, RewardTargetType } from "./keys.ts";

export type RewardMilestoneItem = {
    reward_id: string;                   // PK
    class_id: string;                    // GSI1 PK
    unlock_sort: string;                 // GSI1 SK — "{ACTIVE|INACTIVE}#00005#TYPE#reward_id"
    created_by_teacher_id: string;       // GSI2 PK
    teacher_sort: string;                // GSI2 SK — "class_id#{ACTIVE|INACTIVE}#00005#reward_id"
    title: string;
    description: string;
    unlock_level: number;
    type: RewardType;
    reward_target_type?: RewardTargetType;
    reward_target_id?: string;
    image_asset_key?: string;
    is_active: boolean;
    is_deleted: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
    updated_by_teacher_id?: string;
    notes?: string;
};

export type CreateRewardMilestoneInput = {
    class_id: string;
    created_by_teacher_id: string;
    title: string;
    description: string;
    unlock_level: number;
    type: RewardType;
    reward_target_type?: RewardTargetType;
    reward_target_id?: string;
    image_asset_key?: string;
    is_active?: boolean;
    notes?: string;
};

export type UpdateRewardMilestoneInput = {
    title?: string;
    description?: string;
    unlock_level?: number;
    type?: RewardType;
    reward_target_type?: RewardTargetType;
    reward_target_id?: string;
    image_asset_key?: string | null;
    notes?: string;
    updated_by_teacher_id?: string;
};

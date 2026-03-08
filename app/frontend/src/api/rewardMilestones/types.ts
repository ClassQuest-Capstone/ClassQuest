/**
 * Reward milestone type definitions
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type RewardType =
    | "HELMET"
    | "ARMOR_SET"
    | "BACKGROUND"
    | "PET"
    | "BADGE"
    | "PRIVILEGE"
    | "CUSTOM";

export type RewardTargetType =
    | "ITEM"
    | "AVATAR_TIER"
    | "BACKGROUND"
    | "PET"
    | "BADGE"
    | "CUSTOM";

// ─── Core model ───────────────────────────────────────────────────────────────

/** Full reward milestone as returned by teacher-facing endpoints. */
export type RewardMilestone = {
    reward_id: string;
    class_id: string;
    created_by_teacher_id: string;
    title: string;
    description: string;
    unlock_level: number;
    type: RewardType;
    reward_target_type?: RewardTargetType;
    reward_target_id?: string;
    image_asset_path?: string;
    is_active: boolean;
    is_deleted: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    updated_by_teacher_id?: string;
    notes?: string;
    /** GSI sort keys — present on the raw API response; rarely needed by UI code. */
    unlock_sort?: string;
    teacher_sort?: string;
};

// ─── Student model ────────────────────────────────────────────────────────────

/** Student-facing reward view with lock/unlock status computed server-side. */
export type StudentRewardMilestone = {
    reward_id: string;
    title: string;
    description: string;
    unlock_level: number;
    type: RewardType;
    image_asset_path?: string;
    locked: boolean;
    unlocked: boolean;
    reached_level: number;
};

export type StudentRewardMilestonesResponse = {
    class_id: string;
    student_level: number;
    rewards: StudentRewardMilestone[];
};

// ─── Request payloads ─────────────────────────────────────────────────────────

export type CreateRewardMilestoneRequest = {
    class_id: string;
    /** TODO: replace with JWT claim once auth is wired. */
    created_by_teacher_id: string;
    title: string;
    description: string;
    unlock_level: number;
    type: RewardType;
    reward_target_type?: RewardTargetType;
    reward_target_id?: string;
    image_asset_path?: string;
    is_active?: boolean;
    notes?: string;
};

export type UpdateRewardMilestoneRequest = {
    title?: string;
    description?: string;
    unlock_level?: number;
    type?: RewardType;
    reward_target_type?: RewardTargetType;
    reward_target_id?: string;
    image_asset_path?: string;
    notes?: string;
    /** TODO: replace with JWT claim once auth is wired. */
    updated_by_teacher_id?: string;
};

// ─── Response shapes ──────────────────────────────────────────────────────────

export type RewardMilestoneListResponse = {
    items: RewardMilestone[];
};

export type SoftDeleteRewardMilestoneResponse = {
    reward_id: string;
    message: string;
};

export type SetRewardMilestoneStatusResponse = {
    reward_id: string;
    is_active: boolean;
    message: string;
};

export type RestoreRewardMilestoneResponse = {
    reward_id: string;
    message: string;
};

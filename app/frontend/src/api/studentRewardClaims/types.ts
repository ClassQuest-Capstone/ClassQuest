/**
 * Student reward claims type definitions
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ClaimStatus = "AVAILABLE" | "CLAIMED";

export type RewardStateStatus = "LOCKED" | "AVAILABLE" | "CLAIMED";

export type RewardTargetType =
    | "ITEM"
    | "AVATAR_TIER"
    | "BACKGROUND"
    | "PET"
    | "BADGE"
    | "CUSTOM";

// ─── Core model ───────────────────────────────────────────────────────────────

/** Full student reward claim row as returned by the API. */
export type StudentRewardClaim = {
    student_reward_claim_id: string;
    student_id: string;
    class_id: string;
    reward_id: string;
    status: ClaimStatus;
    claim_sort: string;
    unlocked_at_level: number;
    unlocked_at?: string;
    claimed_at?: string;
    reward_target_type?: RewardTargetType;
    reward_target_id?: string;
    created_at: string;
    updated_at: string;
    notes?: string;
};

// ─── Request payloads ─────────────────────────────────────────────────────────

export type CreateStudentRewardClaimRequest = {
    student_id: string;
    class_id: string;
    reward_id: string;
    status: ClaimStatus;
    unlocked_at_level: number;
    reward_target_type?: RewardTargetType;
    reward_target_id?: string;
    unlocked_at?: string;
    claimed_at?: string;
    notes?: string;
};

export type ClaimStudentRewardRequest = {
    student_id: string;
    class_id: string;
};

export type CreateAvailableClaimsForLevelUpRequest = {
    class_id: string;
    old_level: number;
    new_level: number;
};

// ─── Response shapes ──────────────────────────────────────────────────────────

export type StudentRewardClaimListResponse = {
    items: StudentRewardClaim[];
};

export type ClaimStudentRewardResponse = {
    message: string;
    reward_id: string;
    student_id: string;
    status: "CLAIMED";
    claimed_at: string;
};

export type CreateAvailableClaimsForLevelUpResponse = {
    student_id: string;
    class_id: string;
    old_level: number;
    new_level: number;
    created_count: number;
    created_claims: StudentRewardClaim[];
};

// ─── Merged rewards state (UI) ────────────────────────────────────────────────

/** One reward entry in the merged rewards-state response. */
export type StudentRewardStateItem = {
    reward_id: string;
    title: string;
    description: string;
    unlock_level: number;
    type: string;
    image_asset_key?: string;
    state: RewardStateStatus;
    claimed_at: string | null;
    unlocked_at: string | null;
};

export type StudentRewardsStateResponse = {
    class_id: string;
    student_id: string;
    student_level: number;
    rewards: StudentRewardStateItem[];
};

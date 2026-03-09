import type { ClaimStatus, RewardTargetType } from "./keys.ts";

/** A student-specific claim row for one reward milestone. */
export type StudentRewardClaimItem = {
    student_reward_claim_id: string;  // PK — UUID
    student_id: string;               // GSI1 PK
    claim_sort: string;               // GSI1 SK: "{status}#{class_id}#{level_5d}#{reward_id}"
    reward_id: string;                // GSI2 PK
    class_id: string;
    status: ClaimStatus;
    unlocked_at_level: number;
    unlocked_at?: string;             // ISO timestamp — set when status = AVAILABLE
    claimed_at?: string;              // ISO timestamp — set when status = CLAIMED
    reward_target_type?: RewardTargetType;
    reward_target_id?: string;
    created_at: string;
    updated_at: string;
    notes?: string;
};

export type CreateStudentRewardClaimInput = {
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

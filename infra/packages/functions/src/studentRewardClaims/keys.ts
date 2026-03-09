export const CLAIM_STATUSES = ["AVAILABLE", "CLAIMED"] as const;
export type ClaimStatus = typeof CLAIM_STATUSES[number];

// Kept local to avoid cross-module dependency; mirrors rewardMilestones/keys.ts
export const REWARD_TARGET_TYPES = [
    "ITEM",
    "AVATAR_TIER",
    "BACKGROUND",
    "PET",
    "BADGE",
    "CUSTOM",
] as const;
export type RewardTargetType = typeof REWARD_TARGET_TYPES[number];

/**
 * Build the GSI1 sort key (claim_sort).
 *
 * Format: "{status}#{class_id}#{level_5digits}#{reward_id}"
 * Example: "AVAILABLE#class_123#00005#reward_helmet_lvl5"
 *
 * Guarantees:
 *  - Groups by status first (AVAILABLE before CLAIMED)
 *  - Then by class_id
 *  - Level is zero-padded to 5 digits for correct numeric order
 *  - reward_id suffix ensures uniqueness when class+level collide
 */
export function buildClaimSort(
    status: ClaimStatus,
    class_id: string,
    unlocked_at_level: number,
    reward_id: string
): string {
    const level = String(unlocked_at_level).padStart(5, "0");
    return `${status}#${class_id}#${level}#${reward_id}`;
}

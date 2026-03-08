export const REWARD_TYPES = [
    "HELMET",
    "ARMOR_SET",
    "BACKGROUND",
    "PET",
    "BADGE",
    "PRIVILEGE",
    "CUSTOM",
] as const;

export type RewardType = typeof REWARD_TYPES[number];

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
 * Build the GSI1 sort key (unlock_sort).
 *
 * Format: "{ACTIVE|INACTIVE}#{level_5digits}#{type}#{reward_id}"
 * Example: "ACTIVE#00005#HELMET#reward_abc123"
 *
 * Guarantees:
 *  - Active rewards sort before inactive (A < I lexicographically)
 *  - Level is zero-padded to 5 digits for correct numeric order
 *  - reward_id suffix ensures uniqueness when level+type collide
 */
export function buildUnlockSort(
    is_active: boolean,
    unlock_level: number,
    type: string,
    reward_id: string
): string {
    const prefix = is_active ? "ACTIVE" : "INACTIVE";
    const level = String(unlock_level).padStart(5, "0");
    return `${prefix}#${level}#${type}#${reward_id}`;
}

/**
 * Build the GSI2 sort key (teacher_sort).
 *
 * Format: "{class_id}#{ACTIVE|INACTIVE}#{level_5digits}#{reward_id}"
 * Example: "class_123#ACTIVE#00005#reward_abc123"
 *
 * Groups a teacher's rewards by class, then by active/inactive, then by level.
 */
export function buildTeacherSort(
    class_id: string,
    is_active: boolean,
    unlock_level: number,
    reward_id: string
): string {
    const prefix = is_active ? "ACTIVE" : "INACTIVE";
    const level = String(unlock_level).padStart(5, "0");
    return `${class_id}#${prefix}#${level}#${reward_id}`;
}

import { randomUUID } from "crypto";
import { createRewardMilestone } from "./repo.js";
import { buildUnlockSort, buildTeacherSort } from "./keys.js";
import type { RewardMilestoneItem } from "./types.js";

/**
 * The default set of reward milestones created for every new class.
 * reward_target_id values must match seeded ShopItem / AvatarBase IDs.
 */
const DEFAULT_REWARD_TEMPLATES = [
    {
        title:              "Beginner Forest",
        description:        "A peaceful forest clearing for new adventurers.",
        unlock_level:       5,
        type:               "BACKGROUND",
        reward_target_type: "BACKGROUND" as const,
        reward_target_id:   "background_beginner_forest",
        image_asset_key:    "seed/avatar-system/shop-items/background/background_beginner_forest.png",
    },
    {
        title:              "Copper Guardian Armour",
        description:        "Reliable copper armour forged for guardians.",
        unlock_level:       10,
        type:               "ARMOR_SET",
        reward_target_type: "ITEM" as const,
        reward_target_id:   "guardian_armour_copper",
        image_asset_key:    "seed/avatar-system/shop-items/armour/guardian_armour_copper.png",
    },
    {
        title:              "Holy Healer Armour",
        description:        "Light armour imbued with holy protection.",
        unlock_level:       10,
        type:               "ARMOR_SET",
        reward_target_type: "ITEM" as const,
        reward_target_id:   "healer_armour_holy",
        image_asset_key:    "seed/avatar-system/shop-items/armour/healer_armour_holy.png",
    },
    {
        title:              "Crimson Mage Armour",
        description:        "Arcane crimson robes that protect the wearer.",
        unlock_level:       10,
        type:               "ARMOR_SET",
        reward_target_type: "ITEM" as const,
        reward_target_id:   "mage_armour_crimson",
        image_asset_key:    "seed/avatar-system/shop-items/armour/mage_armour_crimson.png",
    },
    {
        title:              "Copper Guardian Helmet",
        description:        "A sturdy copper helmet worn by guardians.",
        unlock_level:       15,
        type:               "HELMET",
        reward_target_type: "ITEM" as const,
        reward_target_id:   "guardian_helmet_copper",
        image_asset_key:    "seed/avatar-system/shop-items/helmet/guardian_helmet_copper.png",
    },
    {
        title:              "Holy Healer Helmet",
        description:        "A blessed helmet that channels healing energy.",
        unlock_level:       15,
        type:               "HELMET",
        reward_target_type: "ITEM" as const,
        reward_target_id:   "healer_helmet_holy",
        image_asset_key:    "seed/avatar-system/shop-items/helmet/healer_helmet_holy.png",
    },
    {
        title:              "Crimson Mage Helmet",
        description:        "A striking crimson helmet worn by mages.",
        unlock_level:       15,
        type:               "HELMET",
        reward_target_type: "ITEM" as const,
        reward_target_id:   "mage_helmet_crimson",
        image_asset_key:    "seed/avatar-system/shop-items/helmet/mage_helmet_crimson.png",
    },
    {
        title:              "Copper Guardian Shield",
        description:        "A defensive copper shield for guardians.",
        unlock_level:       20,
        type:               "WEAPON",
        reward_target_type: "ITEM" as const,
        reward_target_id:   "guardian_shield_copper",
        image_asset_key:    "seed/avatar-system/shop-items/shield/guardian_shield_copper.png",
    },
    {
        title:              "Holy Healer Staff",
        description:        "A radiant staff wielded by healers.",
        unlock_level:       20,
        type:               "WEAPON",
        reward_target_type: "ITEM" as const,
        reward_target_id:   "healer_shield_holy",
        image_asset_key:    "seed/avatar-system/shop-items/shield/healer_shield_holy.png",
    },
    {
        title:              "Crimson Mage Book",
        description:        "A magical crimson tome wielded by mages.",
        unlock_level:       20,
        type:               "WEAPON",
        reward_target_type: "ITEM" as const,
        reward_target_id:   "mage_weapon_crimson",
        image_asset_key:    "seed/avatar-system/shop-items/weapon/mage_weapon_crimson.png",
    },
    {
        title:              "Dog",
        description:        "A loyal dog companion.",
        unlock_level:       25,
        type:               "PET",
        reward_target_type: "PET" as const,
        reward_target_id:   "pet_dog",
        image_asset_key:    "seed/avatar-system/shop-items/pet/pet_dog.png",
    },
    {
        title:              "Town Background",
        description:        "A lively town square backdrop.",
        unlock_level:       30,
        type:               "BACKGROUND",
        reward_target_type: "BACKGROUND" as const,
        reward_target_id:   "background_town",
        image_asset_key:    "seed/avatar-system/shop-items/background/background_town.png",
    },
] as const;

/**
 * Create the default set of reward milestones for a newly created class.
 * Each milestone gets a fresh UUID so the same defaults can exist across many classes.
 * Errors are thrown to the caller — treat as best-effort at the call site.
 */
export async function createDefaultRewardMilestones(
    class_id: string,
    teacher_id: string
): Promise<void> {
    const now = new Date().toISOString();

    for (const tmpl of DEFAULT_REWARD_TEMPLATES) {
        const reward_id = randomUUID();

        const item: RewardMilestoneItem = {
            reward_id,
            class_id,
            created_by_teacher_id: teacher_id,
            title:               tmpl.title,
            description:         tmpl.description,
            unlock_level:        tmpl.unlock_level,
            type:                tmpl.type,
            reward_target_type:  tmpl.reward_target_type,
            reward_target_id:    tmpl.reward_target_id,
            image_asset_key:     tmpl.image_asset_key,
            is_active:           true,
            is_deleted:          false,
            unlock_sort:  buildUnlockSort(true, tmpl.unlock_level, tmpl.type, reward_id),
            teacher_sort: buildTeacherSort(class_id, true, tmpl.unlock_level, reward_id),
            created_at: now,
            updated_at: now,
        };

        await createRewardMilestone(item);
    }
}

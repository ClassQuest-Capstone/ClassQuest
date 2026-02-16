import { useState, useCallback, useEffect } from "react";
import { getPlayerState, upsertPlayerState, type PlayerState } from "../../../api/playerStates.js";
import { getStudentProfile, type StudentProfile } from "../../../api/studentProfiles.js";

// Types
export interface PlayerProfile {
  studentId: string;
  classId: string;
  displayName: string;
  level: number;
  totalXP: number;
  currentXP: number;
  gold: number;
  hearts: number;
  maxHearts: number;
  unlockedRewards: number[]; // reward levels
  purchasedRewards: number[];
  equippedItems: Record<string, string | null>;
}

export interface Reward {
  level: number;
  title: string;
  description: string;
  cost: number;
  unlocked: boolean;
  purchased: boolean;
}

// Constants
const BASE_XP_FOR_LEVEL_2 = 500; // XP needed to reach level 2
const XP_INCREASE_PER_LEVEL = 100; // Each level requires +100 more XP
const MAX_LEVEL = 30;

// Reward milestones
export const REWARD_MILESTONES: Reward[] = [
  {
    level: 5,
    title: "Music Time",
    description: "Pick a class playlist (5 min)",
    cost: 50,
    unlocked: false,
    purchased: false,
  },
  {
    level: 10,
    title: "Phone Time",
    description: "Phone break (5 min)",
    cost: 75,
    unlocked: false,
    purchased: false,
  },
  {
    level: 15,
    title: "Seat Choice",
    description: "Choose your seat for the day",
    cost: 100,
    unlocked: false,
    purchased: false,
  },
  {
    level: 20,
    title: "Partner Pick",
    description: "Choose your partner once",
    cost: 125,
    unlocked: false,
    purchased: false,
  },
  {
    level: 25,
    title: "Snack Pass",
    description: "Snack during independent work",
    cost: 150,
    unlocked: false,
    purchased: false,
  },
  {
    level: 30,
    title: "Game Time",
    description: "Quick classroom game (10 min)",
    cost: 200,
    unlocked: false,
    purchased: false,
  },
];

/**
 * Calculate XP required to reach next level
 * Formula: 500 + ((level - 1) * 100)
 */
export const calculateXPForLevel = (level: number): number => {
  if (level <= 1) return 0;
  return BASE_XP_FOR_LEVEL_2 + (level - 2) * XP_INCREASE_PER_LEVEL;
};

/**
 * Calculate total XP needed from level 1 to reach target level
 */
export const calculateTotalXPForLevel = (targetLevel: number): number => {
  let total = 0;
  for (let i = 2; i <= targetLevel; i++) {
    total += calculateXPForLevel(i);
  }
  return total;
};

/**
 * Determine level from total XP
 */
export const getLevelFromXP = (totalXP: number): number => {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    if (totalXP < calculateTotalXPForLevel(level + 1)) {
      return level;
    }
  }
  return MAX_LEVEL;
};

/**
 * Calculate current XP within current level (for progress bar)
 */
export const getXPIntoLevel = (totalXP: number): number => {
  const currentLevel = getLevelFromXP(totalXP);
  const xpForCurrentLevel = calculateTotalXPForLevel(currentLevel);
  return totalXP - xpForCurrentLevel;
};

/**
 * Main hook for player progression
 */
export const usePlayerProgression = (
  studentId: string,
  classId: string
) => {
  const [profile, setProfile] = useState<PlayerProfile>({
    studentId,
    classId,
    displayName: "",
    level: 1,
    totalXP: 0,
    currentXP: 0,
    gold: 0,
    hearts: 0,
    maxHearts: 5,
    unlockedRewards: [],
    purchasedRewards: [],
    equippedItems: {},
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update player after gaining XP
   */
  const gainXP = useCallback(
    async (amount: number, source: "quest" | "boss") => {
      setLoading(true);
      setError(null);

      try {
        const goldGain = source === "quest" ? 30 : 100;
        const newTotalXP = profile.totalXP + amount;
        const newLevel = getLevelFromXP(newTotalXP);
        const newUnlockedRewards = getUnlockedRewardsForLevel(newLevel);

        const updatedProfile: PlayerProfile = {
          ...profile,
          totalXP: newTotalXP,
          currentXP: getXPIntoLevel(newTotalXP),
          level: newLevel,
          gold: profile.gold + goldGain,
          unlockedRewards: [
            ...new Set([...profile.unlockedRewards, ...newUnlockedRewards]),
          ],
        };

        setProfile(updatedProfile);

        return {
          leveledUp: newLevel > profile.level,
          previousLevel: profile.level,
          newLevel,
          xpGained: amount,
          goldEarned: goldGain,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [profile]
  );

  /**
   * Get rewards unlocked up to a certain level
   */
  const getUnlockedRewardsForLevel = (level: number): number[] => {
    return REWARD_MILESTONES.filter((r) => r.level <= level).map((r) =>
      r.level
    );
  };

  /**
   * Purchase a reward with gold
   */
  const purchaseReward = useCallback(
    async (rewardLevel: number) => {
      setLoading(true);
      setError(null);

      try {
        const reward = REWARD_MILESTONES.find((r) => r.level === rewardLevel);

        if (!reward) {
          throw new Error("Reward not found");
        }

        if (!profile.unlockedRewards.includes(rewardLevel)) {
          throw new Error("Reward not unlocked");
        }

        if (profile.purchasedRewards.includes(rewardLevel)) {
          throw new Error("Reward already purchased");
        }

        if (profile.gold < reward.cost) {
          throw new Error("Not enough gold");
        }

        const updatedProfile: PlayerProfile = {
          ...profile,
          gold: profile.gold - reward.cost,
          purchasedRewards: [...profile.purchasedRewards, rewardLevel],
        };

        setProfile(updatedProfile);
        return { success: true, goldRemaining: updatedProfile.gold };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [profile]
  );

  /**
   * Get rewards with unlocked/purchased status
   */
  const getRewardsWithStatus = useCallback((): Reward[] => {
    return REWARD_MILESTONES.map((reward) => ({
      ...reward,
      unlocked: profile.unlockedRewards.includes(reward.level),
      purchased: profile.purchasedRewards.includes(reward.level),
    }));
  }, [profile.unlockedRewards, profile.purchasedRewards]);

  /**
   * Get current XP progress for level bar (total_xp_earned used for level calculation, current_xp used for progress within level)
   */
  const getXPProgress = useCallback((): {
    current: number;
    needed: number;
    percentage: number;
  } => {
    const currentLevelTotalXP = calculateTotalXPForLevel(profile.level);
    const nextLevelTotalXP = calculateTotalXPForLevel(profile.level + 1);
    const xpNeededForLevel = nextLevelTotalXP - currentLevelTotalXP;
    const xpIntoCurrentLevel = profile.totalXP - currentLevelTotalXP;
    const percentage = (xpIntoCurrentLevel / xpNeededForLevel) * 100;

    return {
      current: xpIntoCurrentLevel,
      needed: xpNeededForLevel,
      percentage: Math.min(percentage, 100),
    };
  }, [profile.level, profile.totalXP]);

  /**
   * Get milestone progress (for rewards road)
   */
  const getMilestoneProgress = useCallback((): {
    percentage: number;
    nextMilestone: number | null;
  } => {
    const lastMilestone = REWARD_MILESTONES[REWARD_MILESTONES.length - 1]?.level || MAX_LEVEL;
    const percentage = (profile.level / lastMilestone) * 100;

    const nextUnlockedMilestone = REWARD_MILESTONES.find(
      (r) => r.level > profile.level
    );

    return {
      percentage: Math.min(percentage, 100),
      nextMilestone: nextUnlockedMilestone?.level || null,
    };
  }, [profile.level]);

  /**
   * Equip an item
   */
  const equipItem = useCallback((slot: string, itemId: string | null) => {
    setProfile((prev) => ({
      ...prev,
      equippedItems: {
        ...prev.equippedItems,
        [slot]: itemId,
      },
    }));
  }, []);

  /**
   * Load player profile and state from backend on mount
   */
  useEffect(() => {
    // Only fetch if both studentId and classId are valid
    if (!studentId || !classId) {
      return;
    }

    const initializeProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch student profile for display name
        const studentProfile = await getStudentProfile(studentId);
        
        // Try to fetch player state for XP, gold, hearts
        let playerState: PlayerState;

        try {
          playerState = await getPlayerState(classId, studentId);
        } catch (fetchError: any) {
          // If player state doesn't exist, backend returns an error like "Player state not found" or HTTP 404 
          const msg =
            typeof fetchError?.message === "string"
              ? fetchError.message.toLowerCase()
              : "";

          if (
            msg.includes("player state not found") ||
            msg.includes("http 404") ||
            msg.includes("404")
          ) {
            const defaultState = {
              current_xp: 0,
              xp_to_next_level: BASE_XP_FOR_LEVEL_2,
              total_xp_earned: 0,
              hearts: 5,
              max_hearts: 5,
              gold: 0,
              status: "ALIVE" as const,
            };

            // Upsert the new player state
            await upsertPlayerState(classId, studentId, defaultState);

            // Fetch it back to get the full object with metadata
            playerState = await getPlayerState(classId, studentId);
          } else {
            // Re-throw if it's a different error
            throw fetchError;
          }
        }

        const newLevel = getLevelFromXP(playerState.total_xp_earned);
        const newUnlockedRewards = getUnlockedRewardsForLevel(newLevel);

        setProfile({
          studentId,
          classId,
          displayName: studentProfile.display_name || "",
          level: newLevel,
          totalXP: playerState.total_xp_earned,
          currentXP: playerState.current_xp,
          gold: playerState.gold,
          hearts: playerState.hearts,
          maxHearts: playerState.max_hearts,
          unlockedRewards: newUnlockedRewards,
          purchasedRewards: [],
          equippedItems: {},
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load player profile";
        setError(message);
        console.error("Player progression initialization error:", err);
        // Keep initial state on error
      } finally {
        setLoading(false);
      }
    };

    initializeProfile();
  }, [studentId, classId]);

  return {
    profile,
    loading,
    error,
    gainXP,
    purchaseReward,
    getRewardsWithStatus,
    getXPProgress,
    getMilestoneProgress,
    equipItem,
  };
};
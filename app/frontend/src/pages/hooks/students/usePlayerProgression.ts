import { useState, useCallback, useEffect } from "react";

// Types
export interface PlayerStats {
  hp: number;
  strength: number;
  intelligence: number;
  speed: number;
}

export interface PlayerProfile {
  studentId: string;
  level: number;
  totalXP: number;
  currentXP: number;
  gold: number;
  stats: PlayerStats;
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
const BASE_HP = 20;
const HP_PER_LEVEL = 5;
const STAT_CAP = 100;
const MAX_STAT_POINTS_PER_LEVEL = 5;

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
 * Calculate HP based on level
 */
export const calculateHP = (level: number): number => {
  return BASE_HP + HP_PER_LEVEL * level;
};

/**
 * Calculate stat progression (scales gradually from 0 to 100)
 * Formula: (level / MAX_LEVEL) * STAT_CAP
 */
export const calculateStat = (level: number): number => {
  return Math.min((level / MAX_LEVEL) * STAT_CAP, STAT_CAP);
};

/**
 * Initialize or update player stats based on level
 */
export const calculateStats = (level: number): PlayerStats => {
  const baseStat = calculateStat(level);

  return {
    hp: calculateHP(level),
    strength: Math.round(baseStat),
    intelligence: Math.round(baseStat),
    speed: Math.round(baseStat),
  };
};

/**
 * Main hook for player progression
 */
export const usePlayerProgression = (
  initialProfile?: Partial<PlayerProfile>
) => {
  const [profile, setProfile] = useState<PlayerProfile>(() => ({
    studentId: initialProfile?.studentId || "student-001",
    level: initialProfile?.level || 1,
    totalXP: initialProfile?.totalXP || 0,
    currentXP: initialProfile?.currentXP || 0,
    gold: initialProfile?.gold || 0,
    stats: initialProfile?.stats || calculateStats(1),
    unlockedRewards: initialProfile?.unlockedRewards || [],
    purchasedRewards: initialProfile?.purchasedRewards || [],
    equippedItems: initialProfile?.equippedItems || {},
  }));

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
        const newTotalXP = profile.totalXP + amount; // update XP earned (FOR MY SELF)
        const newLevel = getLevelFromXP(newTotalXP);
        const newStats = calculateStats(newLevel);
        const newUnlockedRewards = getUnlockedRewardsForLevel(newLevel);

        const updatedProfile: PlayerProfile = {
          ...profile,
          totalXP: newTotalXP,
          currentXP: getXPIntoLevel(newTotalXP),
          level: newLevel,
          gold: profile.gold + goldGain,
          stats: newStats,
          unlockedRewards: [
            ...new Set([...profile.unlockedRewards, ...newUnlockedRewards]),
          ],
        };

        // TODO: Call backend API to persist
        // await updatePlayerBackend(profile.studentId, updatedProfile);

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

        // TODO: Call backend API to persist
        // await purchaseRewardBackend(profile.studentId, rewardLevel);

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
   * Get current XP progress for level bar
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
   * Load player profile (e.g., from backend)
   */
  const loadProfile = useCallback(
    async (studentId: string) => {
      setLoading(true);
      setError(null);

      try {
        // TODO: Replace with actual backend call
        // const data = await fetchPlayerProfile(studentId);
        // setProfile(data);

        // For now, just set the studentId
        setProfile((prev) => ({
          ...prev,
          studentId,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

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
    loadProfile,
  };
};
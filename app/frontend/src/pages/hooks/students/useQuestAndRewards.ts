import { usePlayerProgression } from "./usePlayerProgression.ts";

/**
 * Hook usage for gaining XP and leveling up
 */
export function useQuestCompletion() {
  const { profile, gainXP } = usePlayerProgression();

  const completeQuest = async (questId: string) => {
    try {
      const result = await gainXP(100, "quest"); // +100 XP, +30 gold
      
      if (result.leveledUp) {
        console.log(`Level up! Now level ${result.newLevel}`);
        // Trigger level-up animation/sound
      }
      
      return result;
    } catch (error) {
      console.error("Quest completion failed:", error);
    }
  };

  const completeBossBattle = async (bossId: string) => {
    try {
      const result = await gainXP(300, "boss"); // +300 XP, +100 gold
      
      if (result.leveledUp) {
        console.log(`Boss Battle Victory! Now level ${result.newLevel}`);
        // Trigger victory animation
      }
      
      return result;
    } catch (error) {
      console.error("Boss battle failed:", error);
    }
  };

  return {
    profile,
    completeQuest,
    completeBossBattle,
  };
}

/**
 * Hook usage for purchasing rewards
 */
export function useRewardPurchase() {
  const { profile, purchaseReward, getRewardsWithStatus } = usePlayerProgression();
  const rewards = getRewardsWithStatus();

  const buyReward = async (rewardLevel: number) => {
    try {
      const result = await purchaseReward(rewardLevel);
      console.log(`Reward purchased! Gold remaining: ${result.goldRemaining}`);
      return result;
    } catch (error) {
      console.error("Purchase failed:", error);
    }
  };

  return {
    profile,
    rewards,
    buyReward,
  };
}

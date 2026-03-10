/**
 * XP Progression Formulas - MUST match frontend usePlayerProgression.ts
 * 
 * Progressive scaling:
 * - Level 2: 500 XP
 * - Level 3: 600 XP  
 * - Level 4: 700 XP
 * - ... (increases by 100 XP per level)
 */

export const BASE_XP_FOR_LEVEL_2 = 500;    // XP needed to reach level 2
export const XP_INCREASE_PER_LEVEL = 100;  // Each level requires +100 more XP
export const MAX_LEVEL = 30;

/**
 * Calculate XP required for a specific level
 * Must match frontend calculateXPForLevel()
 */
export function calculateXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return BASE_XP_FOR_LEVEL_2 + (level - 2) * XP_INCREASE_PER_LEVEL;
}

/**
 * Calculate total XP needed from level 1 to reach target level
 * Must match frontend calculateTotalXPForLevel()
 */
export function calculateTotalXPForLevel(targetLevel: number): number {
  let total = 0;
  for (let i = 2; i <= targetLevel; i++) {
    total += calculateXPForLevel(i);
  }
  return total;
}

/**
 * Determine level from total XP
 * Must match frontend getLevelFromXP()
 */
export function getLevelFromXP(totalXP: number): number {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    if (totalXP < calculateTotalXPForLevel(level + 1)) {
      return level;
    }
  }
  return MAX_LEVEL;
}

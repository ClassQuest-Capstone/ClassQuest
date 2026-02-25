/**
 * Seeded pseudorandom number generator and shuffle
 * For deterministic question ordering
 */

/**
 * Simple hash function to convert string seed to number
 */
function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

/**
 * Mulberry32 PRNG
 * Simple, fast, deterministic pseudorandom number generator
 */
function createPRNG(seed: number) {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Fisher-Yates shuffle with seeded PRNG
 * Deterministic: same seed -> same order
 */
export function seededShuffle<T>(array: T[], seed: string): T[] {
    // Create a copy to avoid mutating original
    const shuffled = [...array];

    // Convert seed string to number
    const seedNum = hashString(seed);

    // Create PRNG
    const random = createPRNG(seedNum);

    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

/**
 * Derive a guild-specific seed from base seed + guild_id
 */
export function deriveGuildSeed(baseSeed: string, guildId: string): string {
    return `${baseSeed}:${guildId}`;
}

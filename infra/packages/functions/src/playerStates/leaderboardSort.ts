/**
 * Compute leaderboard sort key for descending XP order in DynamoDB
 *
 * Formula: invert(total_xp_earned) + "#" + student_id
 * where invert(x) = (MAX_XP - x).toString().padStart(10, "0")
 *
 * This allows querying GSI1 in ascending order to get descending XP results.
 *
 * @param total_xp_earned - Total XP earned by the player
 * @param student_id - Student identifier (for uniqueness)
 * @returns Computed sort key string
 */
export function makeLeaderboardSort(total_xp_earned: number, student_id: string): string {
    const MAX_XP = 1_000_000_000;
    const inverted = (MAX_XP - total_xp_earned).toString().padStart(10, "0");
    return `${inverted}#${student_id}`;
}

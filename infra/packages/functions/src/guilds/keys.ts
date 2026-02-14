/**
 * Create GSI1 sort key for stable ordering by creation time
 * Format: created_at#guild_id
 *
 * @param created_at - ISO 8601 timestamp
 * @param guild_id - Guild UUID
 * @returns Composite sort key string
 */
export function makeGsi1Sk(created_at: string, guild_id: string): string {
    return `${created_at}#${guild_id}`;
}

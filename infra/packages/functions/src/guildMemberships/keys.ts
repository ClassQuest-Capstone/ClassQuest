/**
 * Create GSI1 sort key for guild roster ordering
 * Format: joined_at#student_id
 *
 * @param joined_at - ISO 8601 timestamp
 * @param student_id - Student identifier
 * @returns Composite sort key string
 */
export function makeGsi1Sk(joined_at: string, student_id: string): string {
    return `${joined_at}#${student_id}`;
}

/**
 * Create GSI2 sort key for student membership history ordering
 * Format: joined_at#class_id#guild_id
 *
 * @param joined_at - ISO 8601 timestamp
 * @param class_id - Class identifier
 * @param guild_id - Guild identifier
 * @returns Composite sort key string
 */
export function makeGsi2Sk(joined_at: string, class_id: string, guild_id: string): string {
    return `${joined_at}#${class_id}#${guild_id}`;
}

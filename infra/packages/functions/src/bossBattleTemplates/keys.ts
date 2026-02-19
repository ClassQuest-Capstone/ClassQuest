/**
 * Generate public_sort key for GSI2
 * Format: ${subject || "UNSPECIFIED"}#${created_at}#${boss_template_id}
 *
 * This allows efficient querying and browsing of public templates:
 * - Filter by subject prefix (e.g., "MATH#")
 * - Sort by creation date
 * - Stable ordering with ID suffix
 *
 * @param subject - Optional subject (e.g., "MATH", "SCIENCE")
 * @param created_at - ISO timestamp
 * @param boss_template_id - Template UUID
 * @returns Composite sort key
 *
 * @example
 * makePublicSort("MATH", "2024-01-15T10:00:00Z", "abc-123")
 * // => "MATH#2024-01-15T10:00:00Z#abc-123"
 *
 * makePublicSort(undefined, "2024-01-15T10:00:00Z", "abc-123")
 * // => "UNSPECIFIED#2024-01-15T10:00:00Z#abc-123"
 */
export function makePublicSort(
    subject: string | undefined,
    created_at: string,
    boss_template_id: string
): string {
    const subjectKey = subject || "UNSPECIFIED";
    return `${subjectKey}#${created_at}#${boss_template_id}`;
}

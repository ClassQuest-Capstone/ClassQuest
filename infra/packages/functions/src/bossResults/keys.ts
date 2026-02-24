/**
 * Key building functions for BossResults
 */

/**
 * Build boss_result_pk: BI#<boss_instance_id>
 */
export function buildBossResultPk(bossInstanceId: string): string {
    return `BI#${bossInstanceId}`;
}

/**
 * Build student result SK: STU#<student_id>
 */
export function buildStudentResultSk(studentId: string): string {
    return `STU#${studentId}`;
}

/**
 * Build guild result SK: GUILD#<guild_id>
 */
export function buildGuildResultSk(guildId: string): string {
    return `GUILD#${guildId}`;
}

/**
 * Build meta result SK: META
 */
export function buildMetaResultSk(): string {
    return "META";
}

/**
 * Build GSI1 sort key: completed_at#boss_instance_id
 */
export function buildGsi1Sk(completedAt: string, bossInstanceId: string): string {
    return `${completedAt}#${bossInstanceId}`;
}

/**
 * Build GSI2 sort key: completed_at#boss_instance_id
 */
export function buildGsi2Sk(completedAt: string, bossInstanceId: string): string {
    return `${completedAt}#${bossInstanceId}`;
}

/**
 * Check if SK is a student row
 */
export function isStudentRow(sk: string): boolean {
    return sk.startsWith("STU#");
}

/**
 * Check if SK is a guild row
 */
export function isGuildRow(sk: string): boolean {
    return sk.startsWith("GUILD#");
}

/**
 * Check if SK is a meta row
 */
export function isMetaRow(sk: string): boolean {
    return sk === "META";
}

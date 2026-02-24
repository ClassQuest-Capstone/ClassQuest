/**
 * Key building functions for BossAnswerAttempts
 */

import { randomUUID } from "crypto";

/**
 * Build boss_attempt_pk: BI#<boss_instance_id>#Q#<question_id>
 */
export function buildBossAttemptPk(
    bossInstanceId: string,
    questionId: string
): string {
    return `BI#${bossInstanceId}#Q#${questionId}`;
}

/**
 * Build attempt_sk: T#<answered_at>#S#<student_id>#A#<uuid>
 */
export function buildAttemptSk(
    answeredAt: string,
    studentId: string,
    uuid?: string
): string {
    const attemptUuid = uuid || randomUUID();
    return `T#${answeredAt}#S#${studentId}#A#${attemptUuid}`;
}

/**
 * Build GSI2 sort key: answered_at#boss_instance_id#question_id
 */
export function buildGsi2Sk(
    answeredAt: string,
    bossInstanceId: string,
    questionId: string
): string {
    return `${answeredAt}#${bossInstanceId}#${questionId}`;
}

/**
 * Build GSI3 partition key: boss_instance_id#student_id
 */
export function buildGsi3Pk(bossInstanceId: string, studentId: string): string {
    return `${bossInstanceId}#${studentId}`;
}

/**
 * Build GSI3 sort key: answered_at#question_id
 */
export function buildGsi3Sk(answeredAt: string, questionId: string): string {
    return `${answeredAt}#${questionId}`;
}

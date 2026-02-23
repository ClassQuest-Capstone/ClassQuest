export enum TeacherGradeStatus {
    PENDING = "PENDING",
    GRADED = "GRADED"
}

export enum GraderType {
    AUTO = "AUTO",
    TEACHER = "TEACHER",
    SYSTEM = "SYSTEM"
}

export type QuestAnswerAttemptItem = {
    // Primary keys
    quest_attempt_pk: string;
    attempt_sk: string;

    // Core attributes
    quest_instance_id: string;
    student_id: string;
    question_id: string;
    attempt_no: number;
    answer_raw: string;
    answer_normalized?: string;
    is_correct?: boolean;
    auto_grade_result?: string; // JSON string
    teacher_grade_status?: TeacherGradeStatus;
    graded_at?: string;
    grader_type?: GraderType;
    created_at: string;

    // Reward linkage (optional)
    xp_awarded?: number;
    gold_awarded?: number;
    reward_txn_id?: string;

    // GSI keys
    gsi1_pk: string;
    gsi1_sk: string;
    gsi2_pk: string;
    gsi2_sk: string;
};

/**
 * Build primary key for quest attempt
 * Format: QI#<quest_instance_id>#S#<student_id>#Q#<question_id>
 */
export function buildQuestAttemptPK(
    quest_instance_id: string,
    student_id: string,
    question_id: string
): string {
    return `QI#${quest_instance_id}#S#${student_id}#Q#${question_id}`;
}

/**
 * Build sort key for attempt
 * Format: A#<attempt_no_padded>#T#<created_at_iso>
 */
export function buildAttemptSK(attempt_no: number, created_at: string): string {
    const paddedAttemptNo = String(attempt_no).padStart(6, "0");
    return `A#${paddedAttemptNo}#T#${created_at}`;
}

/**
 * Build GSI keys for quest answer attempt
 */
export function buildGSIKeys(
    quest_instance_id: string,
    student_id: string,
    question_id: string,
    attempt_no: number,
    created_at: string
): {
    gsi1_pk: string;
    gsi1_sk: string;
    gsi2_pk: string;
    gsi2_sk: string;
} {
    const paddedAttemptNo = String(attempt_no).padStart(6, "0");

    // GSI1: student attempts within quest instance
    const gsi1_pk = `S#${student_id}#QI#${quest_instance_id}`;
    const gsi1_sk = `T#${created_at}#Q#${question_id}#A#${paddedAttemptNo}`;

    // GSI2: question analytics within quest instance
    const gsi2_pk = `QI#${quest_instance_id}#Q#${question_id}`;
    const gsi2_sk = `T#${created_at}#S#${student_id}#A#${paddedAttemptNo}`;

    return { gsi1_pk, gsi1_sk, gsi2_pk, gsi2_sk };
}

/**
 * Build counter key for attempt number allocation
 * Format: COUNTER#QI#<quest_instance_id>#S#<student_id>#Q#<question_id>
 */
export function buildCounterPK(
    quest_instance_id: string,
    student_id: string,
    question_id: string
): string {
    return `COUNTER#QI#${quest_instance_id}#S#${student_id}#Q#${question_id}`;
}

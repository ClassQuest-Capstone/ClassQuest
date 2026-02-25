export enum AutoGradeResult {
    CORRECT = "CORRECT",
    INCORRECT = "INCORRECT",
    PARTIAL = "PARTIAL",
    NOT_APPLICABLE = "NOT_APPLICABLE"
}

export enum ResponseStatus {
    NOT_STARTED = "NOT_STARTED",
    IN_PROGRESS = "IN_PROGRESS",
    SUBMITTED = "SUBMITTED",
    NEEDS_REVIEW = "NEEDS_REVIEW",
    INCORRECT = "INCORRECT",
    CORRECT = "CORRECT",
    GRADED = "GRADED"
}

export enum RewardStatus {
    PENDING = "PENDING",
    APPLIED = "APPLIED",
    REVERSED = "REVERSED"
}

export type QuestQuestionResponseItem = {
    // Primary key
    instance_student_pk: string;        // quest_instance_id#student_id
    question_id: string;                // SK

    // Core fields
    response_id: string;                // UUID for audit
    quest_instance_id: string;
    student_id: string;
    class_id: string;
    answer_raw: Record<string, any>;    // map type - stores the student's answer

    // Auto-grading
    is_auto_graded: boolean;
    auto_grade_result?: AutoGradeResult;
    auto_points_awarded?: number;

    // Teacher grading
    teacher_points_awarded?: number;
    teacher_comment?: string;
    graded_at?: string;                 // ISO timestamp
    graded_by_teacher_id?: string;

    // Timestamps
    submitted_at: string;               // ISO timestamp

    // GSI sort keys
    gsi1sk: string;                     // submitted_at#student_id#question_id
    gsi2sk: string;                     // submitted_at#quest_instance_id#question_id
    gsi3sk: string;                     // submitted_at#student_id#quest_instance_id

    // Summary counters and status
    attempt_count: number;              // Total attempts (default: 0)
    wrong_attempt_count: number;        // Wrong attempts (default: 0)
    status: ResponseStatus;             // Response status (default: derived)

    // Reward linkage fields
    xp_awarded_total: number;           // Total XP awarded (default: 0)
    gold_awarded_total: number;         // Total gold awarded (default: 0)
    reward_txn_id?: string;             // Link to RewardTransactions (optional)
    reward_status?: RewardStatus;       // Reward application status (optional)
};

/**
 * Derive status from response data if not explicitly set
 */
export function deriveResponseStatus(item: Partial<QuestQuestionResponseItem>): ResponseStatus {
    // If no answer exists, it's not started
    if (!item.answer_raw || Object.keys(item.answer_raw).length === 0) {
        return ResponseStatus.NOT_STARTED;
    }

    // If teacher graded, it's GRADED
    if (item.teacher_points_awarded !== undefined) {
        return ResponseStatus.GRADED;
    }

    // If submitted and auto-gradable
    if (item.submitted_at && item.is_auto_graded && item.auto_points_awarded !== undefined) {
        return item.auto_points_awarded > 0 ? ResponseStatus.CORRECT : ResponseStatus.INCORRECT;
    }

    // If submitted but not auto-gradable, needs review
    if (item.submitted_at && !item.is_auto_graded) {
        return ResponseStatus.NEEDS_REVIEW;
    }

    // If answer exists but not submitted, it's in progress
    if (item.answer_raw) {
        return ResponseStatus.IN_PROGRESS;
    }

    return ResponseStatus.NOT_STARTED;
}

/**
 * Derive reward status based on reward fields
 */
export function deriveRewardStatus(item: Partial<QuestQuestionResponseItem>): RewardStatus | undefined {
    // If reward_txn_id is present, it's APPLIED
    if (item.reward_txn_id) {
        return RewardStatus.APPLIED;
    }

    // If XP or gold awarded but no txn_id, it's PENDING
    if ((item.xp_awarded_total && item.xp_awarded_total > 0) ||
        (item.gold_awarded_total && item.gold_awarded_total > 0)) {
        return RewardStatus.PENDING;
    }

    // Otherwise not eligible yet
    return undefined;
}

/**
 * Apply defaults to response item for backward compatibility
 */
export function normalizeResponseItem(item: Partial<QuestQuestionResponseItem>): QuestQuestionResponseItem {
    return {
        ...item,
        attempt_count: item.attempt_count ?? 0,
        wrong_attempt_count: item.wrong_attempt_count ?? 0,
        status: item.status ?? deriveResponseStatus(item),
        xp_awarded_total: item.xp_awarded_total ?? 0,
        gold_awarded_total: item.gold_awarded_total ?? 0,
        reward_status: item.reward_status ?? deriveRewardStatus(item),
    } as QuestQuestionResponseItem;
}

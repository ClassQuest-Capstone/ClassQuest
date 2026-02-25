import { TeacherGradeStatus, GraderType } from "./types.js";

const MAX_ANSWER_LENGTH = 20000; // 20k characters

/**
 * Validate required IDs
 */
export function validateRequiredIds(data: {
    quest_instance_id?: string;
    student_id?: string;
    question_id?: string;
}): { valid: boolean; error?: string } {
    if (!data.quest_instance_id || typeof data.quest_instance_id !== "string") {
        return { valid: false, error: "quest_instance_id is required" };
    }
    if (!data.student_id || typeof data.student_id !== "string") {
        return { valid: false, error: "student_id is required" };
    }
    if (!data.question_id || typeof data.question_id !== "string") {
        return { valid: false, error: "question_id is required" };
    }
    return { valid: true };
}

/**
 * Validate answer_raw
 */
export function validateAnswerRaw(answer_raw: any): { valid: boolean; error?: string } {
    if (!answer_raw || typeof answer_raw !== "string") {
        return { valid: false, error: "answer_raw is required and must be a string" };
    }
    if (answer_raw.length > MAX_ANSWER_LENGTH) {
        return { valid: false, error: `answer_raw must be <= ${MAX_ANSWER_LENGTH} characters` };
    }
    return { valid: true };
}

/**
 * Validate teacher_grade_status enum
 */
export function validateTeacherGradeStatus(status: string): { valid: boolean; error?: string } {
    const validStatuses = Object.values(TeacherGradeStatus);
    if (!validStatuses.includes(status as TeacherGradeStatus)) {
        return {
            valid: false,
            error: `teacher_grade_status must be one of: ${validStatuses.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate grader_type enum
 */
export function validateGraderType(type: string): { valid: boolean; error?: string } {
    const validTypes = Object.values(GraderType);
    if (!validTypes.includes(type as GraderType)) {
        return {
            valid: false,
            error: `grader_type must be one of: ${validTypes.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate reward amounts
 */
export function validateRewardAmounts(data: {
    xp_awarded?: number;
    gold_awarded?: number;
}): { valid: boolean; error?: string } {
    if (data.xp_awarded !== undefined) {
        if (typeof data.xp_awarded !== "number" || data.xp_awarded < 0) {
            return { valid: false, error: "xp_awarded must be a number >= 0" };
        }
    }
    if (data.gold_awarded !== undefined) {
        if (typeof data.gold_awarded !== "number" || data.gold_awarded < 0) {
            return { valid: false, error: "gold_awarded must be a number >= 0" };
        }
    }
    return { valid: true };
}

/**
 * Validate reward_txn_id
 */
export function validateRewardTxnId(reward_txn_id: any): { valid: boolean; error?: string } {
    if (reward_txn_id !== undefined) {
        if (typeof reward_txn_id !== "string" || reward_txn_id.trim().length === 0) {
            return { valid: false, error: "reward_txn_id must be a non-empty string if provided" };
        }
    }
    return { valid: true };
}

/**
 * Validate create attempt data
 */
export function validateCreateAttemptData(data: {
    quest_instance_id?: string;
    student_id?: string;
    question_id?: string;
    answer_raw?: any;
    answer_normalized?: any;
}): { valid: boolean; error?: string } {
    // Validate required IDs
    const idsValidation = validateRequiredIds({
        quest_instance_id: data.quest_instance_id,
        student_id: data.student_id,
        question_id: data.question_id,
    });
    if (!idsValidation.valid) return idsValidation;

    // Validate answer_raw
    const answerValidation = validateAnswerRaw(data.answer_raw);
    if (!answerValidation.valid) return answerValidation;

    // answer_normalized is optional, no strict validation
    return { valid: true };
}

/**
 * Validate grade attempt data
 */
export function validateGradeAttemptData(data: {
    is_correct?: boolean;
    grader_type?: string;
    teacher_grade_status?: string;
    xp_awarded?: number;
    gold_awarded?: number;
    reward_txn_id?: any;
    auto_grade_result?: any;
}): { valid: boolean; error?: string } {
    // Validate is_correct
    if (data.is_correct !== undefined && typeof data.is_correct !== "boolean") {
        return { valid: false, error: "is_correct must be a boolean" };
    }

    // Validate grader_type
    if (data.grader_type) {
        const graderTypeValidation = validateGraderType(data.grader_type);
        if (!graderTypeValidation.valid) return graderTypeValidation;
    }

    // Validate teacher_grade_status
    if (data.teacher_grade_status) {
        const statusValidation = validateTeacherGradeStatus(data.teacher_grade_status);
        if (!statusValidation.valid) return statusValidation;
    }

    // Validate reward amounts
    const rewardValidation = validateRewardAmounts({
        xp_awarded: data.xp_awarded,
        gold_awarded: data.gold_awarded,
    });
    if (!rewardValidation.valid) return rewardValidation;

    // Validate reward_txn_id
    const txnIdValidation = validateRewardTxnId(data.reward_txn_id);
    if (!txnIdValidation.valid) return txnIdValidation;

    return { valid: true };
}

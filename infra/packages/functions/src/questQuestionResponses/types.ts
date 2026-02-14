export enum AutoGradeResult {
    CORRECT = "CORRECT",
    INCORRECT = "INCORRECT",
    PARTIAL = "PARTIAL",
    NOT_APPLICABLE = "NOT_APPLICABLE"
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
};

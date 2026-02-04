// Legacy question types (backward compatibility)
export type QuestionType = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY" | "OTHER";

// New question formats (preferred)
export type QuestionFormat =
    | "MCQ_SINGLE"
    | "MCQ_MULTI"
    | "TRUE_FALSE"
    | "MATCHING"
    | "ORDERING"
    | "FILL_BLANK"
    | "NUMERIC"
    | "SHORT_ANSWER"
    | "ESSAY"
    | "OTHER";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

// Structured option formats for different question types
export type MCQOptions = {
    choices: Array<{ id: string; text: string }>;
};

export type MatchingOptions = {
    left: Array<{ id: string; text: string }>;
    right: Array<{ id: string; text: string }>;
};

export type OrderingOptions = {
    items: Array<{ id: string; text: string }>;
};

export type FillBlankOptions = {
    text: string;
    blanks: Array<{ id: string }>;
};

// Structured answer formats
export type MCQSingleAnswer = {
    choiceId: string;
};

export type MCQMultiAnswer = {
    choiceIds: string[];
};

export type MatchingAnswer = {
    pairs: Array<{ leftId: string; rightId: string }>;
};

export type OrderingAnswer = {
    order: string[];
};

export type FillBlankAnswer = {
    blanks: Record<string, string[]>;
};

export type NumericAnswer =
    | { value: number; tolerance?: number }
    | { min: number; max: number };

export type QuestQuestionItem = {
    question_id: string;           // UUID - Primary Key
    quest_template_id: string;     // Parent template (GSI1 PK)
    order_key: string;             // Zero-padded order like "0001" (GSI1 SK)
    order_index: number;           // Numeric order for convenience

    // Preferred: use question_format
    question_format: QuestionFormat;  // New format enum (preferred)

    // Legacy: kept for backward compatibility (optional in new records)
    question_type?: QuestionType;  // Legacy type enum (deprecated)

    prompt: string;                // Question text
    options?: any;                 // Structured format based on question_format
    correct_answer?: any;          // Expected answer, structured format
    max_points: number;            // Maximum points for this question
    auto_gradable: boolean;        // Whether system can auto-grade
    rubric_text?: string;          // Grading rubric for manual grading

    // New optional fields
    difficulty?: Difficulty;       // Question difficulty level
    hint?: string;                 // Optional hint for students
    explanation?: string;          // Explanation shown after answering
    time_limit_seconds?: number;   // Optional time limit for this question
};

export type CreateQuestionInput = Omit<QuestQuestionItem, "question_id" | "order_key">;

export type UpdateQuestionInput = Partial<
    Pick<
        QuestQuestionItem,
        | "order_index"
        | "order_key"
        | "question_format"
        | "question_type"
        | "prompt"
        | "options"
        | "correct_answer"
        | "max_points"
        | "auto_gradable"
        | "rubric_text"
        | "difficulty"
        | "hint"
        | "explanation"
        | "time_limit_seconds"
    >
>;

/**
 * Map legacy question_type to new question_format
 */
export function mapLegacyTypeToFormat(question_type: QuestionType): QuestionFormat {
    const mapping: Record<QuestionType, QuestionFormat> = {
        "MCQ": "MCQ_SINGLE",
        "TRUE_FALSE": "TRUE_FALSE",
        "SHORT_ANSWER": "SHORT_ANSWER",
        "ESSAY": "ESSAY",
        "OTHER": "OTHER",
    };
    return mapping[question_type];
}

/**
 * Map question_format back to legacy question_type for backward compatibility
 */
export function mapFormatToLegacyType(question_format: QuestionFormat): QuestionType | null {
    const mapping: Partial<Record<QuestionFormat, QuestionType>> = {
        "MCQ_SINGLE": "MCQ",
        "TRUE_FALSE": "TRUE_FALSE",
        "SHORT_ANSWER": "SHORT_ANSWER",
        "ESSAY": "ESSAY",
        "OTHER": "OTHER",
    };
    return mapping[question_format] ?? null;
}

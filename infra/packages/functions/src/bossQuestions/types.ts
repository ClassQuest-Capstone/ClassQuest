/**
 * Question types for boss battles
 */
export type BossQuestionType =
    | "MCQ_SINGLE"
    | "MCQ_MULTI"
    | "TRUE_FALSE"
    | "SHORT_ANSWER"
    | "NUMERIC"
    | "OTHER";

/**
 * Boss question item stored in DynamoDB
 */
export type BossQuestionItem = {
    question_id: string;                    // UUID - Primary Key
    boss_template_id: string;               // Parent boss template (GSI1 PK)
    order_index: number;                    // Numeric order (0-based)
    order_key: string;                      // Zero-padded order like "000001" (GSI1 SK)
    question_text: string;                  // The question prompt
    question_type: BossQuestionType;        // Type of question
    options?: any;                          // Options for MCQ/matching questions
    correct_answer?: any;                   // Expected answer (for auto-gradable questions)
    damage_to_boss_on_correct?: number;     // Legacy — damage is now fixed at 1
    damage_to_guild_on_incorrect?: number;  // Legacy — hearts are now individual
    max_points?: number;                    // Optional: max points for grading
    xp_reward?: number;                     // Optional: XP awarded on correct answer
    auto_gradable: boolean;                 // Whether system can auto-grade
    time_limit_seconds?: number;            // Optional: time limit for this question (overrides battle default)
    image_asset_key?: string;               // Optional S3 object key for question image
    created_at: string;                     // ISO timestamp
    updated_at: string;                     // ISO timestamp
};

export type CreateBossQuestionInput = Omit<
    BossQuestionItem,
    "question_id" | "order_key" | "created_at" | "updated_at"
>;

export type UpdateBossQuestionInput = Partial<
    Pick<
        BossQuestionItem,
        | "order_index"
        | "question_text"
        | "question_type"
        | "options"
        | "correct_answer"
        | "damage_to_boss_on_correct"
        | "damage_to_guild_on_incorrect"
        | "max_points"
        | "xp_reward"
        | "auto_gradable"
        | "time_limit_seconds"
        | "image_asset_key"
    >
> & { image_asset_key?: string | null };

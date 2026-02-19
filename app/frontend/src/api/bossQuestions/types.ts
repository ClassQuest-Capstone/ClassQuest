/**
 * Boss question type definitions
 */

export type BossQuestionType =
    | "MCQ_SINGLE"
    | "MCQ_MULTI"
    | "TRUE_FALSE"
    | "SHORT_ANSWER"
    | "NUMERIC"
    | "OTHER";

export type BossQuestion = {
    question_id: string;
    boss_template_id: string;
    order_index: number;
    order_key: string;
    question_text: string;
    question_type: BossQuestionType;
    options?: any;
    correct_answer?: any;
    damage_to_boss_on_correct: number;
    damage_to_guild_on_incorrect: number;
    max_points?: number;
    auto_gradable: boolean;
    created_at: string;
    updated_at: string;
};

export type CreateBossQuestionInput = {
    order_index: number;
    question_text: string;
    question_type: BossQuestionType;
    options?: any;
    correct_answer?: any;
    damage_to_boss_on_correct: number;
    damage_to_guild_on_incorrect: number;
    max_points?: number;
    auto_gradable: boolean;
};

export type UpdateBossQuestionInput = Partial<CreateBossQuestionInput>;

export type PaginatedBossQuestions = {
    items: BossQuestion[];
    cursor?: string;
};

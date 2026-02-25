/**
 * Boss Battle Question Plans type definitions
 */

export type ModeType =
    | "SIMULTANEOUS_ALL"
    | "TURN_BASED_GUILD"
    | "RANDOMIZED_PER_GUILD";

export type QuestionSelectionMode = "ORDERED" | "RANDOM_NO_REPEAT";

export type BossBattleQuestionPlanGlobal = {
    plan_id: string;
    boss_instance_id: string;
    class_id: string;
    boss_template_id: string;
    mode_type: "SIMULTANEOUS_ALL" | "TURN_BASED_GUILD";
    question_selection_mode: QuestionSelectionMode;
    created_by_teacher_id: string;
    created_at: string;
    version: number;
    question_ids: string[];
    question_count: number;
    seed?: string;
    source_questions_hash?: string;
};

export type BossBattleQuestionPlanPerGuild = {
    plan_id: string;
    boss_instance_id: string;
    class_id: string;
    boss_template_id: string;
    mode_type: "RANDOMIZED_PER_GUILD";
    question_selection_mode: QuestionSelectionMode;
    created_by_teacher_id: string;
    created_at: string;
    version: number;
    guild_question_ids: Record<string, string[]>;
    guild_question_count: Record<string, number>;
    seed?: string;
    source_questions_hash?: string;
};

export type BossBattleQuestionPlan =
    | BossBattleQuestionPlanGlobal
    | BossBattleQuestionPlanPerGuild;

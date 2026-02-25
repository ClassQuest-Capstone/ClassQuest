/**
 * BossBattleQuestionPlans type definitions
 * Deterministic question sequences for boss battles
 */

// Mode types
export type ModeType =
    | "SIMULTANEOUS_ALL"
    | "TURN_BASED_GUILD"
    | "RANDOMIZED_PER_GUILD";

// Question selection modes
export type QuestionSelectionMode = "ORDERED" | "RANDOM_NO_REPEAT";

// Global plan (used by SIMULTANEOUS_ALL and TURN_BASED_GUILD)
export type BossBattleQuestionPlanGlobal = {
    // Primary key
    plan_id: string;                  // ULID/UUID

    // Metadata
    boss_instance_id: string;
    class_id: string;
    boss_template_id: string;
    mode_type: ModeType;
    question_selection_mode: QuestionSelectionMode;
    created_by_teacher_id: string;
    created_at: string;               // ISO timestamp
    version: number;                  // Start at 1

    // Global plan payload
    question_ids: string[];           // Ordered sequence
    question_count: number;           // Must match question_ids.length

    // Optional reproducibility fields
    seed?: string;                    // PRNG seed for shuffle
    source_questions_hash?: string;   // Hash of source questions
};

// Per-guild plan (used by RANDOMIZED_PER_GUILD)
export type BossBattleQuestionPlanPerGuild = {
    // Primary key
    plan_id: string;                  // ULID/UUID

    // Metadata
    boss_instance_id: string;
    class_id: string;
    boss_template_id: string;
    mode_type: "RANDOMIZED_PER_GUILD";
    question_selection_mode: QuestionSelectionMode;
    created_by_teacher_id: string;
    created_at: string;               // ISO timestamp
    version: number;                  // Start at 1

    // Per-guild plan payload
    guild_question_ids: Record<string, string[]>;     // guild_id -> ordered sequence
    guild_question_count: Record<string, number>;     // guild_id -> count

    // Optional reproducibility fields
    seed?: string;                    // Base PRNG seed
    source_questions_hash?: string;   // Hash of source questions
};

// Union type
export type BossBattleQuestionPlan =
    | BossBattleQuestionPlanGlobal
    | BossBattleQuestionPlanPerGuild;

// Input for creating plan
export type CreateQuestionPlanInput = {
    boss_instance_id: string;
    created_by_teacher_id: string;
};

// Paginated list response
export type PaginatedQuestionPlans = {
    items: BossBattleQuestionPlan[];
    nextToken?: string;
};

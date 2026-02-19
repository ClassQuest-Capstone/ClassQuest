export type QuestType = "QUEST" | "DAILY_QUEST";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type QuestTemplateItem = {
    quest_template_id: string;           // UUID - Primary Key
    owner_teacher_id: string;            // Teacher who created the template (GSI1)
    title: string;                       // Template title
    description: string;                 // Template description
    subject: string;                     // Subject area (e.g., "Mathematics")
    class_id: string;                    // Class identifier
    estimated_duration_minutes: number;  // Estimated completion time
    base_xp_reward: number;              // XP reward for completion
    base_gold_reward: number;            // Gold reward for completion
    is_shared_publicly: boolean;         // Whether template is in public library
    type: QuestType;                     // Quest type enum
    grade: number;                       // Target grade level (5-8)
    difficulty: Difficulty;              // Difficulty level enum
    visibility_pk: string;               // "PUBLIC" or "PRIVATE" (GSI2 PK)
    public_sort: string;                 // subject#grade#difficulty#created_at (GSI2 SK)
    created_at: string;                  // ISO timestamp when created
    updated_at: string;                  // ISO timestamp when last updated
    // Soft delete fields
    is_deleted?: boolean;                // Whether template is soft deleted
    deleted_at?: string;                 // ISO timestamp when deleted
    deleted_by_teacher_id?: string;      // Teacher who deleted the template
};

export type CreateQuestTemplateInput = Omit<
    QuestTemplateItem,
    "quest_template_id" | "visibility_pk" | "public_sort" | "created_at" | "updated_at"
>;

export type UpdateQuestTemplateInput = Partial<
    Pick<
        QuestTemplateItem,
        | "title"
        | "description"
        | "subject"
        | "estimated_duration_minutes"
        | "base_xp_reward"
        | "base_gold_reward"
        | "is_shared_publicly"
        | "type"
        | "grade"
        | "difficulty"
    >
>;

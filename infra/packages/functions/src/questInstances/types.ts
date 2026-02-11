export type QuestInstanceStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type QuestInstanceItem = {
    quest_instance_id: string;
    quest_template_id?: string | null;  // nullable - can be null for custom quests
    class_id: string;
    title_override?: string;
    description_override?: string;
    status: QuestInstanceStatus;
    start_date?: string;  // ISO date string
    due_date?: string;    // ISO date string
    requires_manual_approval: boolean;
    created_at: string;
    updated_at: string;
};

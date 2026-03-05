export type QuestInstanceStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "ARCHIVED";

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
    // GSI_SCHEDULE sparse-index keys (present only when status = "SCHEDULED")
    schedule_pk?: string;   // "SCHEDULED"; absent on non-scheduled items
    schedule_sk?: string;   // "${start_date}#${quest_instance_id}"
    activated_at?: string;  // ISO timestamp set by the cron when auto-activated
    created_at: string;
    updated_at: string;
};

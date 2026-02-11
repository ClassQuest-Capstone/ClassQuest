// questInstances.ts
import { api } from "./http.js";

export type QuestInstanceStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type QuestInstance = {
  quest_instance_id: string;
  class_id: string;
  quest_template_id?: string | null;
  title_override?: string;
  description_override?: string;
  status: QuestInstanceStatus;
  start_date?: string | null;
  due_date?: string | null;
  requires_manual_approval: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateQuestInstanceRequest = {
  quest_template_id?: string | null;
  title_override?: string;
  description_override?: string;
  start_date?: string;
  due_date?: string;
  requires_manual_approval: boolean;
  status?: "DRAFT" | "ACTIVE";
};

export type UpdateQuestInstanceStatusRequest = {
  status: QuestInstanceStatus;
};

export type UpdateQuestInstanceDatesRequest = {
  start_date?: string | null;
  due_date?: string | null;
};

/**
 * Create a new quest instance for a class
 * POST /classes/{class_id}/quest-instances
 */
export function createQuestInstance(
  classId: string,
  body: CreateQuestInstanceRequest
) {
  return api<{ quest_instance_id: string; message: string }>(
    `/classes/${encodeURIComponent(classId)}/quest-instances`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

/**
 * Get a quest instance by ID
 * GET /quest-instances/{quest_instance_id}
 */
export function getQuestInstance(id: string) {
  return api<QuestInstance>(`/quest-instances/${encodeURIComponent(id)}`);
}

/**
 * List all quest instances for a class
 * GET /classes/{class_id}/quest-instances
 */
export function listQuestInstancesByClass(classId: string) {
  return api<{ items: QuestInstance[]; count: number }>(
    `/classes/${encodeURIComponent(classId)}/quest-instances`
  );
}

/**
 * List all instances created from a template
 * GET /quest-templates/{quest_template_id}/quest-instances
 */
export function listQuestInstancesByTemplate(templateId: string) {
  return api<{ items: QuestInstance[]; count: number }>(
    `/quest-templates/${encodeURIComponent(templateId)}/quest-instances`
  );
}

/**
 * Update quest instance status
 * PATCH /quest-instances/{quest_instance_id}/status
 */
export function updateQuestInstanceStatus(
  id: string,
  status: QuestInstanceStatus
) {
  return api<{ message: string; quest_instance_id: string; status: string }>(
    `/quest-instances/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
}

/**
 * Update quest instance dates
 * PATCH /quest-instances/{quest_instance_id}/dates
 */
export function updateQuestInstanceDates(
  id: string,
  body: UpdateQuestInstanceDatesRequest
) {
  return api<{ message: string; quest_instance_id: string }>(
    `/quest-instances/${encodeURIComponent(id)}/dates`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
}

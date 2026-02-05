// questTemplates.ts

import { api } from "./http.js";

export type QuestType = "QUEST" | "DAILY_QUEST" | "BOSS_FIGHT";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type QuestTemplate = {
  quest_template_id: string;
  owner_teacher_id: string;
  title: string;
  description: string;
  subject: string;
  estimated_duration_minutes: number;
  base_xp_reward: number;
  base_gold_reward: number;
  is_shared_publicly: boolean;
  type: QuestType;
  grade: number;
  difficulty: Difficulty;
  visibility_pk: string;
  public_sort: string;
  created_at: string;
  updated_at: string;
};

export type CreateQuestTemplateInput = {
  title: string;
  description: string;
  subject: string;
  estimated_duration_minutes: number;
  base_xp_reward: number;
  base_gold_reward: number;
  is_shared_publicly: boolean;
  type: QuestType;
  grade: number;
  difficulty: Difficulty;
  owner_teacher_id: string;
};

export function createQuestTemplate(data: CreateQuestTemplateInput) {
  return api<QuestTemplate>("/quest-templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getQuestTemplate(quest_template_id: string) {
  return api<QuestTemplate>(
    `/quest-templates/${encodeURIComponent(quest_template_id)}`
  );
}

export function getQuestTemplatesByOwner(teacher_id: string) {
  return api<{ items: QuestTemplate[] }>(
    `/teachers/${encodeURIComponent(teacher_id)}/quest-templates`
  );
}

export function getPublicQuestTemplates(
  subject?: string,
  grade?: number,
  difficulty?: Difficulty
) {
  const params = new URLSearchParams();
  if (subject) params.append("subject", subject);
  if (grade) params.append("grade", grade.toString());
  if (difficulty) params.append("difficulty", difficulty);

  return api<{ items: QuestTemplate[] }>(
    `/quest-templates/public?${params.toString()}`
  );
}

export function updateQuestTemplate(
  quest_template_id: string,
  data: Partial<CreateQuestTemplateInput>
) {
  return api<QuestTemplate>(
    `/quest-templates/${encodeURIComponent(quest_template_id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}


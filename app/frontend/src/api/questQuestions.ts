// questQuestions.ts

import { api } from './http.js';

export type QuestionType = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY" | "OTHER";

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

export type QuestQuestion = {
  question_id: string;
  quest_template_id: string;
  order_key: string;
  order_index: number;
  question_format: QuestionFormat;
  question_type?: QuestionType;
  prompt: string;
  options?: any;
  correct_answer?: any;
  max_points: number;
  auto_gradable: boolean;
  rubric_text?: string;
  difficulty?: Difficulty;
  hint?: string;
  explanation?: string;
  time_limit_seconds?: number;
  // Reward configuration fields
  base_xp: number;
  min_xp: number;
  xp_decay_per_wrong: number;
  base_gold: number;
  min_gold: number;
  gold_decay_per_wrong: number;
  decay_exempt: boolean;
};

export function createQuestQuestion(template_id: string, data: Omit<QuestQuestion, "question_id">) {
  return api<QuestQuestion>(`/quest-templates/${encodeURIComponent(template_id)}/questions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listQuestQuestions(template_id: string) {
  return api<{ items: QuestQuestion[] }>(
    `/quest-templates/${encodeURIComponent(template_id)}/questions`
  );
}

export function getQuestQuestion(question_id: string) {
  return api<QuestQuestion>(
    `/quest-questions/${encodeURIComponent(question_id)}`
  );
}

export function updateQuestQuestion(question_id: string, data: Partial<QuestQuestion>) {
  return api<QuestQuestion>(
    `/quest-questions/${encodeURIComponent(question_id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export function deleteQuestQuestion(question_id: string) {
  return api<void>(
    `/quest-questions/${encodeURIComponent(question_id)}`,
    {
      method: "DELETE",
    }
  );
}

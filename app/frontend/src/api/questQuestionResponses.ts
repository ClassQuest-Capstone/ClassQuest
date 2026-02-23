// questQuestionResponses.ts
import { api } from "./http.js";

export type AutoGradeResult = "CORRECT" | "INCORRECT" | "PARTIAL" | "NOT_APPLICABLE";

export type ResponseStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "NEEDS_REVIEW"
  | "INCORRECT"
  | "CORRECT"
  | "GRADED";

export type RewardStatus = "PENDING" | "APPLIED" | "REVERSED";

export type QuestQuestionResponse = {
  instance_student_pk: string;
  question_id: string;
  response_id: string;
  quest_instance_id: string;
  student_id: string;
  class_id: string;
  answer_raw: Record<string, any>;
  is_auto_graded: boolean;
  auto_grade_result?: AutoGradeResult;
  auto_points_awarded?: number;
  teacher_points_awarded?: number;
  teacher_comment?: string;
  graded_at?: string;
  graded_by_teacher_id?: string;
  submitted_at: string;
  gsi1sk: string;
  gsi2sk: string;
  gsi3sk: string;
  // Summary counters and status
  attempt_count: number;
  wrong_attempt_count: number;
  status: ResponseStatus;
  // Reward linkage fields
  xp_awarded_total: number;
  gold_awarded_total: number;
  reward_txn_id?: string;
  reward_status?: RewardStatus;
};

export type UpsertResponseRequest = {
  class_id: string;
  answer_raw: Record<string, any>;
  is_auto_graded: boolean;
  auto_grade_result?: AutoGradeResult;
  auto_points_awarded?: number;
  submitted_at?: string;
};

export type GradeResponseRequest = {
  teacher_points_awarded?: number;
  teacher_comment?: string;
  graded_by_teacher_id?: string;
  status?: ResponseStatus;
  xp_awarded_total?: number;
  gold_awarded_total?: number;
};

export type PaginatedResponseList = {
  ok: boolean;
  responses: QuestQuestionResponse[];
  count: number;
  cursor?: string;
};

/**
 * Upsert a student's response to a quest question.
 * If the response already exists, it will be overwritten.
 * PUT /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}
 */
export function upsertResponse(
  questInstanceId: string,
  questionId: string,
  studentId: string,
  body: UpsertResponseRequest
) {
  return api<{ ok: boolean; response_id: string; submitted_at: string }>(
    `/quest-instances/${encodeURIComponent(questInstanceId)}/questions/${encodeURIComponent(questionId)}/responses/${encodeURIComponent(studentId)}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
}

/**
 * Get all responses for a specific student in a quest instance.
 * Ordered by question_id by default.
 * GET /quest-instances/{quest_instance_id}/responses/{student_id}
 */
export function getResponsesByInstanceAndStudent(
  questInstanceId: string,
  studentId: string,
  options?: {
    limit?: number;
    cursor?: string;
  }
) {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.cursor) params.append("cursor", options.cursor);

  const qs = params.toString();
  return api<PaginatedResponseList>(
    `/quest-instances/${encodeURIComponent(questInstanceId)}/responses/${encodeURIComponent(studentId)}${qs ? `?${qs}` : ""}`
  );
}

/**
 * List all responses for a quest instance.
 * GET /quest-instances/{quest_instance_id}/responses
 */
export function listResponsesByInstance(
  questInstanceId: string,
  options?: {
    limit?: number;
    cursor?: string;
  }
) {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.cursor) params.append("cursor", options.cursor);

  const qs = params.toString();
  return api<PaginatedResponseList>(
    `/quest-instances/${encodeURIComponent(questInstanceId)}/responses${qs ? `?${qs}` : ""}`
  );
}

/**
 * List all responses by a student across all quest instances.
 * GET /students/{student_id}/responses
 */
export function listResponsesByStudent(
  studentId: string,
  options?: {
    limit?: number;
    cursor?: string;
  }
) {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.cursor) params.append("cursor", options.cursor);

  const qs = params.toString();
  return api<PaginatedResponseList>(
    `/students/${encodeURIComponent(studentId)}/responses${qs ? `?${qs}` : ""}`
  );
}

/**
 * List all responses for a specific question across all students and instances.
 * GET /questions/{question_id}/responses
 */
export function listResponsesByQuestion(
  questionId: string,
  options?: {
    limit?: number;
    cursor?: string;
  }
) {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.cursor) params.append("cursor", options.cursor);

  const qs = params.toString();
  return api<PaginatedResponseList>(
    `/questions/${encodeURIComponent(questionId)}/responses${qs ? `?${qs}` : ""}`
  );
}

/**
 * Grade a student's response (teacher action).
 * Sets graded_at automatically on the backend.
 * PATCH /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/grade
 */
export function gradeResponse(
  questInstanceId: string,
  questionId: string,
  studentId: string,
  body: GradeResponseRequest
) {
  return api<{ ok: boolean; graded_at: string }>(
    `/quest-instances/${encodeURIComponent(questInstanceId)}/questions/${encodeURIComponent(questionId)}/responses/${encodeURIComponent(studentId)}/grade`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
}

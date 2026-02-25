// questAnswerAttempts.ts
import { api } from "./http.js";

export type TeacherGradeStatus = "PENDING" | "GRADED";
export type GraderType = "AUTO" | "TEACHER" | "SYSTEM";

export type QuestAnswerAttempt = {
  quest_attempt_pk: string;
  attempt_sk: string;
  quest_instance_id: string;
  student_id: string;
  question_id: string;
  attempt_no: number;
  answer_raw: string;
  answer_normalized?: string;
  is_correct?: boolean;
  auto_grade_result?: string;
  teacher_grade_status?: TeacherGradeStatus;
  graded_at?: string;
  grader_type?: GraderType;
  created_at: string;
  xp_awarded?: number;
  gold_awarded?: number;
  reward_txn_id?: string;
  gsi1_pk: string;
  gsi1_sk: string;
  gsi2_pk: string;
  gsi2_sk: string;
};

export type CreateAttemptRequest = {
  quest_instance_id: string;
  question_id: string;
  answer_raw: string;
  answer_normalized?: string;
};

export type GradeAttemptRequest = {
  is_correct?: boolean;
  grader_type?: GraderType;
  auto_grade_result?: string;
  teacher_grade_status?: TeacherGradeStatus;
  xp_awarded?: number;
  gold_awarded?: number;
  reward_txn_id?: string;
};

export type PaginatedAttemptList = {
  items: QuestAnswerAttempt[];
  cursor?: string;
};

/**
 * Create a new answer attempt for a quest question.
 * POST /quest-answer-attempts
 */
export function createQuestAnswerAttempt(body: CreateAttemptRequest) {
  return api<{ message: string; attempt: QuestAnswerAttempt }>(
    "/quest-answer-attempts",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

/**
 * List all attempts for a specific (quest_instance, student, question) combination.
 * GET /quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts
 */
export function listAttemptsByInstanceStudentQuestion(
  questInstanceId: string,
  studentId: string,
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
  return api<PaginatedAttemptList>(
    `/quest-instances/${encodeURIComponent(questInstanceId)}/students/${encodeURIComponent(studentId)}/questions/${encodeURIComponent(questionId)}/attempts${qs ? `?${qs}` : ""}`
  );
}

/**
 * List all attempts by a student within a quest instance (across all questions).
 * GET /quest-instances/{quest_instance_id}/students/{student_id}/attempts
 */
export function listAttemptsByStudentInInstance(
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
  return api<PaginatedAttemptList>(
    `/quest-instances/${encodeURIComponent(questInstanceId)}/students/${encodeURIComponent(studentId)}/attempts${qs ? `?${qs}` : ""}`
  );
}

/**
 * List all attempts for a question within a quest instance (teacher analytics).
 * GET /quest-instances/{quest_instance_id}/questions/{question_id}/attempts
 */
export function listAttemptsByQuestionInInstance(
  questInstanceId: string,
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
  return api<PaginatedAttemptList>(
    `/quest-instances/${encodeURIComponent(questInstanceId)}/questions/${encodeURIComponent(questionId)}/attempts${qs ? `?${qs}` : ""}`
  );
}

/**
 * Grade a specific attempt (teacher/admin only).
 * PATCH /quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts/{attempt_no}/grade
 */
export function gradeQuestAnswerAttempt(
  questInstanceId: string,
  studentId: string,
  questionId: string,
  attemptNo: number,
  body: GradeAttemptRequest
) {
  return api<{ message: string; graded_at: string }>(
    `/quest-instances/${encodeURIComponent(questInstanceId)}/students/${encodeURIComponent(studentId)}/questions/${encodeURIComponent(questionId)}/attempts/${attemptNo}/grade`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
}

// rewardTransactions.ts
import { api } from "./http.js";

export type SourceType =
  | "QUEST_QUESTION"
  | "QUEST_COMPLETION"
  | "BOSS_BATTLE"
  | "MANUAL_ADJUSTMENT"
  | "SYSTEM_ADJUSTMENT";

export type CreatedByRole = "TEACHER" | "ADMIN" | "SYSTEM";

export type RewardTransaction = {
  transaction_id: string;
  student_id: string;
  class_id?: string;
  xp_delta: number;
  gold_delta: number;
  hearts_delta: number;
  source_type: SourceType;
  source_id?: string;
  quest_instance_id?: string;
  question_id?: string;
  boss_battle_instance_id?: string;
  attempt_pk?: string;
  reason?: string;
  created_at: string;
  created_by: string;
  created_by_role: CreatedByRole;
  metadata?: Record<string, any>;
  gsi1_pk: string;
  gsi1_sk: string;
  gsi2_pk?: string;
  gsi2_sk?: string;
  gsi3_pk?: string;
  gsi3_sk?: string;
};

export type CreateTransactionRequest = {
  transaction_id?: string;
  student_id: string;
  class_id?: string;
  xp_delta: number;
  gold_delta: number;
  hearts_delta: number;
  source_type: SourceType;
  source_id?: string;
  quest_instance_id?: string;
  question_id?: string;
  boss_battle_instance_id?: string;
  attempt_pk?: string;
  reason?: string;
  metadata?: Record<string, any>;
};

export type PaginatedTransactionList = {
  items: RewardTransaction[];
  cursor?: string;
};

/**
 * Create a new reward transaction.
 * Authorization: TEACHER, ADMIN, SYSTEM only
 * POST /reward-transactions
 */
export function createTransaction(body: CreateTransactionRequest) {
  return api<{ message: string; transaction_id: string; item: RewardTransaction }>(
    "/reward-transactions",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

/**
 * Get a single transaction by ID.
 * Authorization: TEACHER, ADMIN, SYSTEM, or the student who owns the transaction
 * GET /reward-transactions/{transaction_id}
 */
export function getTransaction(transactionId: string) {
  return api<RewardTransaction>(
    `/reward-transactions/${encodeURIComponent(transactionId)}`
  );
}

/**
 * List all transactions for a student (across all classes).
 * Authorization: TEACHER, ADMIN, SYSTEM, or the student themselves
 * GET /reward-transactions/by-student/{student_id}
 */
export function listTransactionsByStudent(
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
  return api<PaginatedTransactionList>(
    `/reward-transactions/by-student/${encodeURIComponent(studentId)}${qs ? `?${qs}` : ""}`
  );
}

/**
 * List all transactions for a student in a specific class.
 * Authorization: TEACHER (of that class), ADMIN, SYSTEM, or the student themselves
 * GET /reward-transactions/by-student/{student_id}/class/{class_id}
 */
export function listTransactionsByStudentAndClass(
  studentId: string,
  classId: string,
  options?: {
    limit?: number;
    cursor?: string;
  }
) {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.cursor) params.append("cursor", options.cursor);

  const qs = params.toString();
  return api<PaginatedTransactionList>(
    `/reward-transactions/by-student/${encodeURIComponent(studentId)}/class/${encodeURIComponent(classId)}${qs ? `?${qs}` : ""}`
  );
}

/**
 * List all transactions for a specific source (e.g., quest instance, boss battle).
 * Authorization: TEACHER, ADMIN, SYSTEM only
 * GET /reward-transactions/by-source/{source_type}/{source_id}
 */
export function listTransactionsBySource(
  sourceType: SourceType,
  sourceId: string,
  options?: {
    limit?: number;
    cursor?: string;
  }
) {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", options.limit.toString());
  if (options?.cursor) params.append("cursor", options.cursor);

  const qs = params.toString();
  return api<PaginatedTransactionList>(
    `/reward-transactions/by-source/${encodeURIComponent(sourceType)}/${encodeURIComponent(sourceId)}${qs ? `?${qs}` : ""}`
  );
}

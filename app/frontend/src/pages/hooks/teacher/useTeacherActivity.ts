import { useState, useEffect, useCallback } from "react";
import { listClassesByTeacher, ClassItem } from "../../../api/classes.js";
import { getClassEnrollments, EnrollmentItem } from "../../../api/classEnrollments.js";
import { getStudentProfile, StudentProfile } from "../../../api/studentProfiles.js";
import { listTransactionsByStudentAndClass, listTransactionsByStudent, RewardTransaction, SourceType, } from "../../../api/rewardTransactions.js";

// ─────────────────────────────────────────────────────────────────────────────
// Batch Request Types & Utilities
// ─────────────────────────────────────────────────────────────────────────────

interface BatchRequestItem<T> {
  id: string;
  execute: () => Promise<T>;
}

interface BatchResult<T> {
  id: string;
  success: boolean;
  data?: T;
  error?: Error;
}

interface BatchRequestOptions {
  /** Max concurrent requests per batch (default: 10) */
  concurrency?: number;
  /** Continue on individual request failure (default: true) */
  continueOnError?: boolean;
}

/**
 * Execute multiple API requests as a batch with concurrency control.
 * Groups requests and executes them efficiently with proper error handling.
 */
async function executeBatchRequest<T>(
  requests: BatchRequestItem<T>[],
  options: BatchRequestOptions = {}
): Promise<BatchResult<T>[]> {
  const { concurrency = 10, continueOnError = true } = options;
  const results: BatchResult<T>[] = [];
  const queue = [...requests];

  const executeOne = async (item: BatchRequestItem<T>): Promise<BatchResult<T>> => {
    try {
      const data = await item.execute();
      return { id: item.id, success: true, data };
    } catch (error) {
      if (!continueOnError) throw error;
      return { id: item.id, success: false, error: error as Error };
    }
  };

  // Process in batches with concurrency limit
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    const batchResults = await Promise.all(batch.map(executeOne));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Helper to create batch request items from an array of data
 */
function createBatchRequests<TInput, TOutput>(
  items: TInput[],
  idFn: (item: TInput, index: number) => string,
  executeFn: (item: TInput) => Promise<TOutput>
): BatchRequestItem<TOutput>[] {
  return items.map((item, index) => ({
    id: idFn(item, index),
    execute: () => executeFn(item),
  }));
}

/**
 * Extract successful results from batch response
 */
function getSuccessfulResults<T>(results: BatchResult<T>[]): Map<string, T> {
  const map = new Map<string, T>();
  results.forEach((r) => {
    if (r.success && r.data !== undefined) {
      map.set(r.id, r.data);
    }
  });
  return map;
}

// Types
export type ActivityCategory =
  | "QUEST_COMPLETED"   // student completed a quest / earned quest rewards
  | "BOSS_BATTLE"       // boss-battle related reward
  | "TEACHER_ADJUSTMENT"; // manual XP / gold adjustment by teacher

export interface ActivityItem {
  /** Key for React lists */
  id: string;
  category: ActivityCategory;
  /** Human-readable title */
  title: string;
  /** Student display name */
  studentName: string;
  studentId: string;
  classId: string;
  className: string;
  /** XP delta (can be 0) */
  xpDelta: number;
  /** Gold delta (can be 0) */
  goldDelta: number;
  /** Hearts delta (can be 0) */
  heartsDelta: number;
  /** ISO timestamp from the transaction */
  createdAt: string;
  /** Optional reason field from the transaction to match backend behavior */
  reason?: string;
  /** Source_type from reward-transactions */
  sourceType: SourceType;
}

// Helpers
const TRACKED_SOURCES: SourceType[] = [
  "QUEST_QUESTION",
  "QUEST_COMPLETION",
  "BOSS_BATTLE",
  "MANUAL_ADJUSTMENT",
];

function categorise(src: SourceType): ActivityCategory {
  if (src === "QUEST_QUESTION" || src === "QUEST_COMPLETION") return "QUEST_COMPLETED";
  if (src === "BOSS_BATTLE") return "BOSS_BATTLE";
  return "TEACHER_ADJUSTMENT";
}

function buildTitle(cat: ActivityCategory, studentName: string, tx: RewardTransaction): string {
  switch (cat) {
    case "QUEST_COMPLETED":
      if (tx.source_type === "QUEST_COMPLETION") return `${studentName} completed a quest`;
      return `${studentName} answered a quest question`;
    case "BOSS_BATTLE":
      return `${studentName} participated in a Boss Battle`;
    case "TEACHER_ADJUSTMENT": {
      const parts: string[] = [];
      if (tx.xp_delta !== 0) parts.push(`${tx.xp_delta > 0 ? "+" : ""}${tx.xp_delta} XP`);
      if (tx.gold_delta !== 0) parts.push(`${tx.gold_delta > 0 ? "+" : ""}${tx.gold_delta} Gold`);
     if (tx.hearts_delta !== 0) parts.push(`${tx.hearts_delta > 0 ? "+" : ""}${tx.hearts_delta} Hearts`);
      const delta = parts.length ? parts.join(", ") : "adjustment";
      return `Adjusted ${studentName}: ${delta}`;
    }
  }
}

function toActivityItem(
  tx: RewardTransaction,
  studentName: string,
  className: string,
): ActivityItem {
  const cat = categorise(tx.source_type);
  return {
    id: tx.transaction_id,
    category: cat,
    title: buildTitle(cat, studentName, tx),
    studentName,
    studentId: tx.student_id,
    classId: tx.class_id ?? "",
    className,
    xpDelta: tx.xp_delta,
    goldDelta: tx.gold_delta,
    heartsDelta: tx.hearts_delta,
    createdAt: tx.created_at,
    reason: tx.reason,
    sourceType: tx.source_type,
  };
}

// Hook to fetch and manage teacher activity feed data
export function useTeacherActivity(teacherId: string | undefined) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!teacherId) return;
    setLoading(true);
    setError(null);

    try {
      // Get all active classes owned by this teacher
      const { items: classes } = await listClassesByTeacher(teacherId);
      const activeClasses = classes.filter((c: ClassItem) => c.is_active);

      // Batch fetch enrollments for all classes 
      const enrollmentBatchRequests = createBatchRequests(
        activeClasses,
        (classItem) => classItem.class_id,
        async (classItem) => {
          const { items: enrollments } = await getClassEnrollments(classItem.class_id);
          return { classItem, enrollments: enrollments.filter((e) => e.status === "active") };
        }
      );

      const enrollmentResults = await executeBatchRequest(enrollmentBatchRequests, { concurrency: 10 });
      const enrollmentData = getSuccessfulResults(enrollmentResults);

      // Build class-student pairs from successful enrollment fetches
      const classStudentPairs: { classItem: ClassItem; enrollment: EnrollmentItem }[] = [];
      enrollmentData.forEach(({ classItem, enrollments }) => {
        enrollments.forEach((enrollment) => {
          classStudentPairs.push({ classItem, enrollment });
        });
      });

      // Log any failed enrollment batches
      enrollmentResults
        .filter((r) => !r.success)
        .forEach((r) => console.warn(`Failed to fetch enrollments for class ${r.id}:`, r.error));

      // Batch fetch student profiles 
      const uniqueStudentIds = [...new Set(classStudentPairs.map((p) => p.enrollment.student_id))];
      
      const profileBatchRequests = createBatchRequests(
        uniqueStudentIds,
        (studentId) => studentId,
        async (studentId) => {
          const profile: StudentProfile = await getStudentProfile(studentId);
          return profile.display_name;
        }
      );

      const profileResults = await executeBatchRequest(profileBatchRequests, { concurrency: 10 });
      const profileMap = new Map<string, string>();
      
      profileResults.forEach((result) => {
        if (result.success && result.data) {
          profileMap.set(result.id, result.data);
        } else {
          // Fallback to student ID if profile fetch failed
          profileMap.set(result.id, result.id);
        }
      });

      // Batch fetch transactions per student+class pair
      const allItems: ActivityItem[] = [];
      const classNameMap = new Map<string, string>();
      activeClasses.forEach((c) => classNameMap.set(c.class_id, c.name));
      const teacherClassIds = new Set(activeClasses.map((c) => c.class_id));
      const fetchedStudentClassPairs = new Set<string>();

      const transactionBatchRequests = createBatchRequests(
        classStudentPairs,
        ({ classItem, enrollment }) => `${enrollment.student_id}|${classItem.class_id}`,
        async ({ classItem, enrollment }) => {
          const { items: transactions } = await listTransactionsByStudentAndClass(
            enrollment.student_id,
            classItem.class_id,
            { limit: 50 }
          );
          return { enrollment, classItem, transactions };
        }
      );

      const transactionResults = await executeBatchRequest(transactionBatchRequests, { concurrency: 10 });

      // Process successful transaction batches
      transactionResults.forEach((result) => {
        if (result.success && result.data) {
          const { enrollment, classItem, transactions } = result.data;
          fetchedStudentClassPairs.add(result.id);

          const filtered = transactions.filter((tx) => TRACKED_SOURCES.includes(tx.source_type));
          const displayName = profileMap.get(enrollment.student_id) ?? enrollment.student_id;
          
          filtered.forEach((tx) => {
            allItems.push(toActivityItem(tx, displayName, classItem.name));
          });
        }
      });

      // Batch fallback for missed student+class pairs
      const missedStudents = new Map<string, ClassItem[]>();
      classStudentPairs.forEach(({ classItem, enrollment }) => {
        const pairKey = `${enrollment.student_id}|${classItem.class_id}`;
        if (!fetchedStudentClassPairs.has(pairKey)) {
          const existing = missedStudents.get(enrollment.student_id) || [];
          existing.push(classItem);
          missedStudents.set(enrollment.student_id, existing);
        }
      });

      if (missedStudents.size > 0) {
        const fallbackBatchRequests = createBatchRequests(
          [...missedStudents.entries()],
          ([studentId]) => studentId,
          async ([studentId]) => {
            const { items: transactions } = await listTransactionsByStudent(studentId, { limit: 100 });
            return { studentId, transactions };
          }
        );

        const fallbackResults = await executeBatchRequest(fallbackBatchRequests, { concurrency: 10 });

        fallbackResults.forEach((result) => {
          if (result.success && result.data) {
            const { studentId, transactions } = result.data;
            const displayName = profileMap.get(studentId) ?? studentId;

            transactions.forEach((tx) => {
              if (!TRACKED_SOURCES.includes(tx.source_type)) return;
              const txClassId = tx.class_id ?? "";
              if (!teacherClassIds.has(txClassId)) return;
              if (fetchedStudentClassPairs.has(`${studentId}|${txClassId}`)) return;

              const cName = classNameMap.get(txClassId) ?? txClassId;
              allItems.push(toActivityItem(tx, displayName, cName));
            });
          } else {
            console.warn(`Failed to fetch transactions for student ${result.id}:`, result.error);
          }
        });
      }

      // Sort newest-first
      allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setActivities(allItems);
    } catch (err: any) {
      console.error("Error fetching teacher activity:", err);
      setError(err.message ?? "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return { activities, loading, error, refetch: fetchActivities };
}

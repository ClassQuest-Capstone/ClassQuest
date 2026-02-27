import { useState, useEffect, useCallback } from "react";
import { listClassesByTeacher, ClassItem } from "../../../api/classes.js";
import { getClassEnrollments, EnrollmentItem } from "../../../api/classEnrollments.js";
import { getStudentProfile, StudentProfile } from "../../../api/studentProfiles.js";
import { listTransactionsByStudentAndClass, listTransactionsByStudent, RewardTransaction, SourceType, } from "../../../api/rewardTransactions.js";

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
     // if (tx.hearts_delta !== 0) parts.push(`${tx.hearts_delta > 0 ? "+" : ""}${tx.hearts_delta} Hearts`); (future work)
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

      // For each class, get enrolled students
      const classStudentPairs: {
        classItem: ClassItem;
        enrollment: EnrollmentItem;
      }[] = [];

      await Promise.all(
        activeClasses.map(async (classItem) => {
          try {
            const { items: enrollments } = await getClassEnrollments(classItem.class_id);
            const active = enrollments.filter((e) => e.status === "active");
            active.forEach((enrollment) => {
              classStudentPairs.push({ classItem, enrollment });
            });
          } catch (err) {
            console.warn(`Failed to fetch enrollments for class ${classItem.class_id}:`, err);
          }
        }),
      );

      // Fetch student profiles (student_id)
      const uniqueStudentIds = [...new Set(classStudentPairs.map((p) => p.enrollment.student_id))];
      const profileMap = new Map<string, string>(); 

      await Promise.all(
        uniqueStudentIds.map(async (sid) => {
          try {
            const profile: StudentProfile = await getStudentProfile(sid);
            profileMap.set(sid, profile.display_name);
          } catch {
            profileMap.set(sid, sid); // fallback to ID
          }
        }),
      );

      // For each student+class pair, try fetching reward transactions.
      const allItems: ActivityItem[] = [];

      // Build a class-id -> class-name map for the fallback path
      const classNameMap = new Map<string, string>();
      activeClasses.forEach((c) => classNameMap.set(c.class_id, c.name));

      // Set of class IDs owned by this teacher (for filtering fallback results)
      const teacherClassIds = new Set(activeClasses.map((c) => c.class_id));

      // Track students already fetched via the per-class route
      const fetchedStudentClassPairs = new Set<string>();

      // attempt per-class route first
      await Promise.all(
        classStudentPairs.map(async ({ classItem, enrollment }) => {
          const pairKey = `${enrollment.student_id}|${classItem.class_id}`;
          try {
            const { items: transactions } = await listTransactionsByStudentAndClass(
              enrollment.student_id,
              classItem.class_id,
              { limit: 50 },
            );

            fetchedStudentClassPairs.add(pairKey);

            const filtered = transactions.filter((tx) =>
              TRACKED_SOURCES.includes(tx.source_type),
            );

            const displayName = profileMap.get(enrollment.student_id) ?? enrollment.student_id;
            filtered.forEach((tx) => {
              allItems.push(toActivityItem(tx, displayName, classItem.name));
            });
          } catch {
            // per-class route unavailable – will be handled by fallback below
          }
        }),
      );

      // Fallback: per-student route for any student + class pairs we missed 
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
        await Promise.all(
          [...missedStudents.entries()].map(async ([studentId, missedClasses]) => {
            try {
              const { items: transactions } = await listTransactionsByStudent(
                studentId,
                { limit: 100 },
              );

              const displayName = profileMap.get(studentId) ?? studentId;

              // Include transactions belonging to this teacher's classes
              transactions.forEach((tx) => {
                if (!TRACKED_SOURCES.includes(tx.source_type)) return;
                const txClassId = tx.class_id ?? "";
                if (!teacherClassIds.has(txClassId)) return;
                if (fetchedStudentClassPairs.has(`${studentId}|${txClassId}`)) return;

                const cName = classNameMap.get(txClassId) ?? txClassId;
                allItems.push(toActivityItem(tx, displayName, cName));
              });
            } catch (err) {
              console.warn(
                `Failed to fetch transactions for student ${studentId}:`,
                err,
              );
            }
          }),
        );
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

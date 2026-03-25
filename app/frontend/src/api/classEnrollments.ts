import { api } from "./http.js";

export type EnrollmentItem = {
  enrollment_id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
  status: "active" | "dropped";
  dropped_at?: string;
  restored_at?: string;
  updated_at?: string;
};

export type EnrollmentStatusFilter = "active" | "dropped" | "all";

/**
 * Enroll a student in a class.
 * Returns ENROLLMENT_DROPPED (409) if the student was previously removed —
 * a teacher must restore them via restoreStudentEnrollment().
 */
export async function enrollStudent(classId: string, studentId: string): Promise<{ enrollment_id: string; message: string }> {
  return api(`/classes/${classId}/enroll`, {
    method: "POST",
    body: JSON.stringify({ student_id: studentId }),
  });
}

/**
 * Get enrollments for a student (active only by default)
 */
export async function getStudentEnrollments(studentId: string): Promise<{ items: EnrollmentItem[] }> {
  return api(`/students/${studentId}/classes`);
}

/**
 * Get students enrolled in a class.
 * @param status - "active" (default), "dropped", or "all"
 */
export async function getClassEnrollments(
  classId: string,
  status: EnrollmentStatusFilter = "active"
): Promise<{ items: EnrollmentItem[]; status: string }> {
  const qs = status !== "active" ? `?status=${status}` : "";
  return api(`/classes/${classId}/students${qs}`);
}

/**
 * Remove (soft-delete) a student from a class.
 * The enrollment record is preserved with status="dropped".
 */
export async function unenrollStudent(enrollmentId: string): Promise<{ message: string; enrollment_id: string }> {
  return api(`/enrollments/${enrollmentId}`, {
    method: "DELETE",
  });
}

/**
 * Restore a previously dropped student back to the class.
 * Teacher-only. Returns the restored enrollment record.
 * Returns ALREADY_ACTIVE (409) if student is not dropped.
 */
export async function restoreStudentEnrollment(classId: string, studentId: string): Promise<EnrollmentItem> {
  return api(`/classes/${classId}/students/${studentId}/restore`, {
    method: "POST",
  });
}

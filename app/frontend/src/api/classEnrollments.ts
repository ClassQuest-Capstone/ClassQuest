import { api } from "./http.js";

export type EnrollmentItem = {
  enrollment_id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
  status: "active" | "dropped";
  dropped_at?: string;
};

/**
 * Enroll a student in a class
 */
export async function enrollStudent(classId: string, studentId: string): Promise<{ enrollment_id: string; message: string }> {
  return api(`/classes/${classId}/enroll`, {
    method: "POST",
    body: JSON.stringify({ student_id: studentId }),
  });
}

/**
 * Get enrollments for a student
 */
export async function getStudentEnrollments(studentId: string): Promise<{ items: EnrollmentItem[] }> {
  return api(`/students/${studentId}/classes`);
}

/**
 * Get students enrolled in a class
 */
export async function getClassEnrollments(classId: string): Promise<{ items: EnrollmentItem[] }> {
  return api(`/classes/${classId}/students`);
}

/**
 * Unenroll (drop) a student from a class
 */
export async function unenrollStudent(enrollmentId: string): Promise<{ message: string; enrollment_id: string }> {
  return api(`/enrollments/${enrollmentId}`, {
    method: "DELETE",
  });
}

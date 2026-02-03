// Might remove
import { api } from "./http.js";

export type ClassItem = {
  class_id: string;
  school_id: string;
  name: string;
  subject?: string;
  grade_level: number;
  created_by_teacher_id: string;
  join_code: string;
  is_active: boolean;
  deactivated_at?: string;
  created_at: string;
  updated_at?: string;
};

/**
 * Create a new class
 */
export async function createClass(data: {
  school_id: string;
  name: string;
  grade_level: number;
  created_by_teacher_id: string;
  subject?: string;
}): Promise<ClassItem> {
  return api("/classes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * List all classes created by a teacher
 */
export async function listClassesByTeacher(teacherId: string): Promise<{ items: ClassItem[] }> {
  return api(`/teachers/${teacherId}/classes`);
}

/**
 * Deactivate (soft delete) a class
 */
export async function deactivateClass(classId: string): Promise<{ message: string; class_id: string }> {
  return api(`/classes/${classId}/deactivate`, {
    method: "PATCH",
  });
}

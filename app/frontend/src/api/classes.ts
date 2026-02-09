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
 * Validate a join code and get class details
 * Used by students during signup to verify class exists
 */
export async function validateJoinCode(joinCode: string): Promise<ClassItem | null> {
  const normalizedCode = joinCode.toUpperCase();
  console.log("[validateJoinCode] Validating:", { original: joinCode, normalized: normalizedCode });

  try {
    const result = await api<ClassItem>(`/classes/join/${normalizedCode}`);
    console.log("[validateJoinCode] Success:", result);
    return result;
  } catch (err: any) {
    console.log("[validateJoinCode] Error:", {
      message: err.message,
      error: err,
      isNotFound: err.message?.includes("404") || err.message?.includes("CLASS_NOT_FOUND")
    });

    // If 404 (class not found), return null instead of throwing
    if (err.message?.includes("404") || err.message?.includes("CLASS_NOT_FOUND")) {
      return null;
    }
    throw err;
  }
}

/**
 * Deactivate (soft delete) a class
 */
export async function deactivateClass(classId: string): Promise<{ message: string; class_id: string }> {
  return api(`/classes/${classId}/deactivate`, {
    method: "PATCH",
  });
}

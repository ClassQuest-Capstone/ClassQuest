const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:3001/api";

export interface TeacherStats {
  activeStudents: number;
  activeSubjects: number;
  activeTasks: number;
  completionRate: number;
}

export const fetchTeacherStats = async (teacherId: string): Promise<TeacherStats> => {
  try {
    const response = await fetch(`${API_BASE_URL}/teacher/${teacherId}/stats`);
    if (!response.ok) {
      throw new Error("Failed to fetch stats");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching teacher stats:", error);
    // Default values if API fails
    return {
      activeStudents: 0,
      activeSubjects: 0,
      activeTasks: 0,
      completionRate: 0,
    };
  }
};
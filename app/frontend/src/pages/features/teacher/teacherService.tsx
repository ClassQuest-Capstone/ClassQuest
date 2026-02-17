import { api } from "../../../api/http.js";

export interface TeacherStats {
  activeStudents: number;
  activeSubjects: number;
  activeTasks: number;
}

interface ClassResponse {
  items: Array<{
    class_id: string;
    name: string;
    is_active: boolean;
  }>;
}

interface StudentEnrollment {
  enrollment_id: string;
  student_id: string;
  status: string;
}

interface QuestInstance {
  quest_instance_id: string;
  status: string;
}

export interface TopStudent {
  student_id: string;
  display_name: string;
  total_xp_earned: number;
  gold: number;
  class_name: string;
  class_id: string;
}

const calculateLevel = (totalXp: number): number => {
  // Simple level calculation: every 1000 XP = 1 level, minimum level 1
  return Math.max(1, Math.floor(totalXp / 1000) + 1);
};

export const fetchTeacherStats = async (teacherId: string): Promise<TeacherStats> => {
  try {
    // Fetch all classes for teacher
    const classesResponse = await api<ClassResponse>(`/teachers/${teacherId}/classes`);
    
    // Filter only active classes (where is_active = true)
    const activeClasses = classesResponse.items.filter(c => c.is_active === true);
    
    let totalActiveStudents = 0;
    let totalActiveQuests = 0;

    // For each active class, fetch enrolled students and active quests
    for (const classItem of activeClasses) {
      try {
        // Fetch student enrollments for class
        const enrollmentsResponse = await api<{ items: StudentEnrollment[] }>(
          `/classes/${classItem.class_id}/students`
        );
        
        // Count only active enrollments
        const activeEnrollments = enrollmentsResponse.items.filter(
          e => e.status === "active"
        );
        totalActiveStudents += activeEnrollments.length;
      } catch (err) {
        console.warn(`Failed to fetch enrollments for class ${classItem.class_id}:`, err);
      }

      try {
        // Fetch quest instances for class
        const questsResponse = await api<{ items: QuestInstance[] }>(
          `/classes/${classItem.class_id}/quest-instances`
        );
        
        // Count only active quests (quest assigned to a class)
        const activeQuests = questsResponse.items.filter(
          q => q.status && q.status !== "draft" && q.status !== "cancelled"
        );
        totalActiveQuests += activeQuests.length;
      } catch (err) {
        console.warn(`Failed to fetch quests for class ${classItem.class_id}:`, err);
      }
    }

    return {
      activeStudents: totalActiveStudents,
      activeSubjects: activeClasses.length,
      activeTasks: totalActiveQuests,
    };
  } catch (error) {
    console.error("Error fetching teacher stats:", error);
    // Default values if API fails
    return {
      activeStudents: 0,
      activeSubjects: 0,
      activeTasks: 0,
    };
  }
};

export const fetchTopStudents = async (teacherId: string): Promise<TopStudent[]> => {
  try {
    // Fetch all active classes for teacher
    const classesResponse = await api<ClassResponse>(`/teachers/${teacherId}/classes`);
    const activeClasses = classesResponse.items.filter(c => c.is_active === true);

    const allStudents: (TopStudent & { xp: number })[] = [];

    // For each active class, fetch student enrollments and their player states
    for (const classItem of activeClasses) {
      try {
        // Fetch student enrollments for class
        const enrollmentsResponse = await api<{ items: StudentEnrollment[] }>(
          `/classes/${classItem.class_id}/students`
        );

        const activeEnrollments = enrollmentsResponse.items.filter(
          e => e.status === "active"
        );

        // For each student, fetch their profile and player state
        for (const enrollment of activeEnrollments) {
          try {
            // Fetch student profile for display name
            const profileResponse = await api<{ display_name: string }>(
              `/student-profiles/${enrollment.student_id}`
            );

            // Fetch player state for XP and gold
            const playerStateResponse = await api<{
              total_xp_earned: number;
              gold: number;
            }>(`/classes/${classItem.class_id}/players/${enrollment.student_id}/state`);

            allStudents.push({
              student_id: enrollment.student_id,
              display_name: profileResponse.display_name,
              total_xp_earned: playerStateResponse.total_xp_earned || 0,
              gold: playerStateResponse.gold || 0,
              class_name: classItem.name,
              class_id: classItem.class_id,
              xp: playerStateResponse.total_xp_earned || 0,
            });
          } catch (err) {
            console.warn(
              `Failed to fetch profile/state for student ${enrollment.student_id}:`,
              err
            );
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch enrollments for class ${classItem.class_id}:`, err);
      }
    }

    // Sort by XP (descending) taking top 3
    const topThree = allStudents
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 3)
      .map(({ xp, ...student }) => student);

    return topThree;
  } catch (error) {
    console.error("Error fetching top students:", error);
    return [];
  }
};
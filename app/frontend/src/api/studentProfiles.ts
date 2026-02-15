import { api } from "./http.js";

export type StudentProfile = {
    student_id: string;
    school_id: string;
    display_name: string;
    username: string; 
    grade?: string;
    created_at: string;
    updated_at: string;
};

export function createStudentProfile(input: {
    student_id: string;
    school_id: string;
    display_name: string;
    username: string;
    grade?: string;
}) {
    return api<{ ok: true; student_id: string }>("/student-profiles", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function getStudentProfile(student_id: string) {
    return api<StudentProfile>(`/student-profiles/${encodeURIComponent(student_id)}`);
}

export function listStudentsBySchool(school_id: string) {
    return api<{ items: StudentProfile[] }>(`/schools/${encodeURIComponent(school_id)}/students`);
}

export function updateStudentProfile(student_id: string, input: {
    display_name?: string;
    username?: string;
}) {
    return api<{ ok: true; student_id: string }>(
        `/student-profiles/${encodeURIComponent(student_id)}`,
        {
            method: "PATCH",
            body: JSON.stringify(input),
        }
    );
}

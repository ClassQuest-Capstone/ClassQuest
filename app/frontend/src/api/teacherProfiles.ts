import { api } from "./http.js";

export type TeacherProfile = {
    teacher_id: string;
    school_id: string;
    display_name: string;
    email: string;
    created_at: string;
    updated_at: string;
};

export function createTeacherProfile(input: {
    teacher_id: string;
    school_id?: string | null;
    display_name: string;
    email: string;
    }) {
    return api<{ ok: true; teacher_id: string }>("/teacher-profiles", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function getTeacherProfile(teacher_id: string) {
    return api<TeacherProfile>(`/teacher-profiles/${encodeURIComponent(teacher_id)}`);
}

export function listTeachersBySchool(school_id: string) {
    return api<{ items: TeacherProfile[] }>(`/schools/${encodeURIComponent(school_id)}/teachers`);
}

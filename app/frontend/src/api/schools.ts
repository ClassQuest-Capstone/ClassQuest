// School.ts

import { api } from "./http.ts"

export type School = {
    school_id: string;
    name: string;
    division: string;
    city: string;
    province: string;
    created_at: string;
    updated_at: string;
}

export function getSchool(school_id: string) {
    return api<School>(`/schools/${encodeURIComponent(school_id)}`);
}

export function getSchools() {
    return api<{ items: School[] }>(`/schools`);
}

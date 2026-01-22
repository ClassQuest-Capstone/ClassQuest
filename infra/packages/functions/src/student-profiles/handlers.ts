import { putStudentProfile } from "./repo";

export async function createStudentProfileHandler(body: any) {
    const now = new Date().toISOString();

    const item = {
        student_id: body.student_id,
        school_id: body.school_id,
        display_name: body.display_name,
        email: body.email,
        grade: body.grade,
        created_at: now,
        updated_at: now,
    };

    await putStudentProfile(item);
    return { ok: true, student_id: item.student_id };
}

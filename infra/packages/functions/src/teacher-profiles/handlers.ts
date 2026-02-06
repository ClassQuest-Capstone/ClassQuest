import { putTeacherProfile } from "./repo";

export async function createTeacherProfileHandler(body: any) {
    const now = new Date().toISOString();

    // CHANGE LATER: teacher_id is supplied directly (later derive it from Cognito → Users lookup)
    const item = {
        teacher_id: body.teacher_id,
        school_id: body.school_id,
        display_name: body.display_name,
        email: body.email,
        created_at: now,
        updated_at: now,
    };

    await putTeacherProfile(item);
    return { ok: true, teacher_id: item.teacher_id };
}

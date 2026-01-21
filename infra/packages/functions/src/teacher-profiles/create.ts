import { putTeacherProfile } from "./repo";

export const handler = async (event: any) => {
    const body = event.body ? JSON.parse(event.body) : {};
    const now = new Date().toISOString();

    const item = {
        teacher_id: body.teacher_id,
        school_id: body.school_id,
        display_name: body.display_name,
        email: body.email,
        created_at: now,
        updated_at: now,
    };

    await putTeacherProfile(item);

    return {
        statusCode: 201,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true, teacher_id: item.teacher_id }),
    };
};

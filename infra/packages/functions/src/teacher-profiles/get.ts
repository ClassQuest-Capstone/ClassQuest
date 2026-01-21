import { getTeacherProfile } from "./repo";

export const handler = async (event: any) => {
    const teacher_id = event.pathParameters?.teacher_id;
    const item = await getTeacherProfile(teacher_id);

    return {
        statusCode: item ? 200 : 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item ?? { ok: false, error: "NOT_FOUND" }),
    };
};

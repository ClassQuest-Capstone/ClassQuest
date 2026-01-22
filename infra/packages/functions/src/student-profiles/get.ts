import { getStudentProfile } from "./repo";

export const handler = async (event: any) => {
    const student_id = event.pathParameters?.student_id;
    const item = await getStudentProfile(student_id);

    return {
        statusCode: item ? 200 : 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item ?? { ok: false, error: "NOT_FOUND" }),
    };
};
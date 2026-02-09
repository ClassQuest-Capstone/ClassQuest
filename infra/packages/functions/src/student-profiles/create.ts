import { putStudentProfile } from "./repo";

export const handler = async (event: any) => {
    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
        ? JSON.parse(rawBody)
        : (rawBody ?? {});

    // Hard validate required keys (Dynamo PK must exist)
    const student_id = body.student_id;
    const school_id = body.school_id;
    const display_name = body.display_name;
    const username = body.username;

    if (!student_id || !school_id || !display_name || !username) {
        console.log("Bad request body:", { rawBody, bodyKeys: Object.keys(body || {}) });
        return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            ok: false,
            error: "MISSING_REQUIRED_FIELDS",
            required: ["student_id", "school_id", "display_name", "username"],
            received_keys: Object.keys(body || {}),
            received_values: { student_id, school_id, display_name, username },
        }),
        };
    }

    const now = new Date().toISOString();

    const item = {
        student_id,
        school_id,
        display_name,
        username,
        grade: body.grade,
        created_at: now,
        updated_at: now,
    };

    await putStudentProfile(item);

    return {
        statusCode: 201,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true, student_id }),
    };
};

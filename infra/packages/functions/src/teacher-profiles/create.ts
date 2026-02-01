import { putTeacherProfile } from "./repo";

export const handler = async (event: any) => {
    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
        ? JSON.parse(rawBody)
        : (rawBody ?? {});

    const teacher_id = body.teacher_id;
    //const school_id = body.school_id || null;
    const display_name = body.display_name;
    const email = body.email;

    if (!teacher_id || !display_name || !email) {
        console.log("Bad request body:", {
        rawBody,
        received_keys: Object.keys(body || {}),
        });

        return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            ok: false,
            error: "MISSING_REQUIRED_FIELDS",
            required: ["teacher_id", "display_name", "email"],
            received_keys: Object.keys(body || {}),
        }),
        };
    }

    const now = new Date().toISOString();

    const item = {
        teacher_id,
        //school_id,
        display_name,
        email,
        created_at: now,
        updated_at: now,
    };

    await putTeacherProfile(item);

    return {
        statusCode: 201,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true, teacher_id }),
    };
};

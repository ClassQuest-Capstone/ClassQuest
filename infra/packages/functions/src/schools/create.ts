import { putSchool } from "./repo";

export const handler = async (event: any) => {
    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : (rawBody ?? {});

    // Validate required fields
    const school_id = body.school_id;
    const name = body.name;
    const division = body.division;
    const city = body.city;
    const province = body.province;

    if (!school_id || !name || !division || !city || !province) {
        console.log("Bad request body:", { rawBody, bodyKeys: Object.keys(body || {}) });
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ok: false,
                error: "MISSING_REQUIRED_FIELDS",
                required: ["school_id", "name", "division", "city", "province"],
                received_keys: Object.keys(body || {}),
            }),
        };
    }

    const now = new Date().toISOString();

    const item = {
        school_id,
        name,
        division,
        city,
        province,
        created_at: now,
        updated_at: now,
    };

    try {
        await putSchool(item);
        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ok: true, school_id }),
        };
    } catch (error: any) {
        // Handle conditional check failure (duplicate school_id)
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    ok: false,
                    error: "SCHOOL_ALREADY_EXISTS",
                    school_id,
                }),
            };
        }
        throw error;
    }
};

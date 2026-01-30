import { getSchool } from "./repo";

export const handler = async (event: any) => {
    const school_id = event.pathParameters?.school_id;
    const item = await getSchool(school_id);

    return {
        statusCode: item ? 200 : 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item ?? { ok: false, error: "NOT_FOUND" }),
    };
};

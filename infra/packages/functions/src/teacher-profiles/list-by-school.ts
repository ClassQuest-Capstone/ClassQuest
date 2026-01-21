import { listTeachersBySchool } from "./repo";

export const handler = async (event: any) => {
    const school_id = event.pathParameters?.school_id;
    const items = await listTeachersBySchool(school_id);

    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
    };
};

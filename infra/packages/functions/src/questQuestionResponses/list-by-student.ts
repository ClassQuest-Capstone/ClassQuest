import { listByStudent } from "./repo.js";

export const handler = async (event: any) => {
    const student_id = event.pathParameters?.student_id;

    if (!student_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "Missing required path parameter: student_id"
            }),
        };
    }

    const limit = event.queryStringParameters?.limit
        ? parseInt(event.queryStringParameters.limit, 10)
        : undefined;
    const cursor = event.queryStringParameters?.cursor;

    try {
        const result = await listByStudent(student_id, limit, cursor);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ok: true,
                responses: result.items,
                count: result.items.length,
                cursor: result.cursor,
            }),
        };
    } catch (error: any) {
        console.error("Error fetching responses:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "Internal server error" }),
        };
    }
};

import { listByClass } from "./repo.ts";

/**
 * GET /classes/{class_id}/quest-instances
 * List all quest instances for a class
 */
export const handler = async (event: any) => {
    const class_id = event.pathParameters?.class_id;

    if (!class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_CLASS_ID" }),
        };
    }

    try {
        const items = await listByClass(class_id);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items, count: items.length }),
        };
    } catch (error) {
        console.error("Error listing quest instances by class:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

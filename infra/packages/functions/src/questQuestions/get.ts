import { getQuestion } from "./repo.ts";

/**
 * GET /quest-questions/{question_id}
 * Get a single question by ID
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify user has access (owner of template or enrolled student)

    const question_id = event.pathParameters?.question_id;

    if (!question_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_QUESTION_ID" }),
        };
    }

    const item = await getQuestion(question_id);

    return {
        statusCode: item ? 200 : 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item ?? { error: "QUESTION_NOT_FOUND" }),
    };
};

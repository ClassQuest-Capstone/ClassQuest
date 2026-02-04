import { deleteQuestion } from "./repo.ts";

/**
 * DELETE /quest-questions/{question_id}
 * Delete a question
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify user is owner of the quest template

    const question_id = event.pathParameters?.question_id;

    if (!question_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_QUESTION_ID" }),
        };
    }

    try {
        await deleteQuestion(question_id);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                message: "Question deleted successfully",
                question_id,
            }),
        };
    } catch (error: any) {
        console.error("Error deleting question:", error);
        throw error;
    }
};

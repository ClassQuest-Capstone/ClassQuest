import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { deleteQuestion } from "./repo.ts";

/**
 * DELETE /boss-questions/{question_id}
 * Delete a boss question
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const question_id = event.pathParameters?.question_id;

        if (!question_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing question_id in path" }),
            };
        }

        await deleteQuestion(question_id);

        return {
            statusCode: 204,
            headers: { "content-type": "application/json" },
            body: "",
        };
    } catch (error: any) {
        console.error("Error deleting boss question:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: error.message || "Internal server error",
            }),
        };
    }
};

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getQuestion } from "./repo.ts";

/**
 * GET /boss-questions/{question_id}
 * Get a boss question by ID
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

        const question = await getQuestion(question_id);

        if (!question) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Question not found" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(question),
        };
    } catch (error: any) {
        console.error("Error getting boss question:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: error.message || "Internal server error",
            }),
        };
    }
};

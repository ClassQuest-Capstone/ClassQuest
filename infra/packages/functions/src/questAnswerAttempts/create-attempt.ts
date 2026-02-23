import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { createAttemptWithCounter } from "./repo.js";
import { validateCreateAttemptData } from "./validation.js";

/**
 * POST /quest-answer-attempts
 * Create a new answer attempt for a quest question
 *
 * Authorization: student (self only), system
 */
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
        // Extract auth principal from Cognito authorizer
        const userRole = event.requestContext.authorizer?.jwt?.claims?.["cognito:groups"] as string | undefined;
        const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string | undefined;

        if (!userId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized: Missing user identity" }),
            };
        }

        // Parse request body
        const body = JSON.parse(event.body || "{}");

        const {
            quest_instance_id,
            question_id,
            answer_raw,
            answer_normalized,
        } = body;

        // Derive student_id from auth principal
        // Students can only create attempts for themselves
        // System/Admin can specify student_id in body
        let student_id: string;
        const isSystem = userRole?.includes("System");
        const isAdmin = userRole?.includes("Admins");

        if (isSystem || isAdmin) {
            // System/Admin can specify student_id
            student_id = body.student_id || userId;
        } else {
            // Student can only create for themselves
            student_id = userId;
        }

        // Validate input
        const validation = validateCreateAttemptData({
            quest_instance_id,
            student_id,
            question_id,
            answer_raw,
            answer_normalized,
        });

        if (!validation.valid) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: validation.error }),
            };
        }

        // Create timestamp
        const created_at = new Date().toISOString();

        // Create attempt with atomic counter allocation
        const attempt = await createAttemptWithCounter(
            quest_instance_id,
            student_id,
            question_id,
            answer_raw,
            answer_normalized,
            created_at
        );

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: "Attempt created successfully",
                attempt,
            }),
        };
    } catch (error: any) {
        console.error("Error creating quest answer attempt:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

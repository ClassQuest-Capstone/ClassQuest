import { updateAttemptGrade } from "./repo.js";
import { validateGradeAttemptData } from "./validation.js";

/**
 * PATCH /quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts/{attempt_no}/grade
 * Update grading fields for a specific attempt
 *
 * Authorization: teacher, admin, system only (students cannot grade)
 */
export const handler = async (event: any) => {
    try {
        const quest_instance_id = event.pathParameters?.quest_instance_id;
        const student_id = event.pathParameters?.student_id;
        const question_id = event.pathParameters?.question_id;
        const attempt_no_str = event.pathParameters?.attempt_no;

        if (!quest_instance_id || !student_id || !question_id || !attempt_no_str) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing required path parameters" }),
            };
        }

        const attempt_no = parseInt(attempt_no_str, 10);
        if (isNaN(attempt_no) || attempt_no < 1) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "attempt_no must be a positive integer" }),
            };
        }

        // Authorization: Only teachers, admins, or system can grade
        const userRole = event.requestContext?.authorizer?.jwt?.claims?.["cognito:groups"] as string | undefined;
        const userId = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined;

        if (!userId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized: Missing user identity" }),
            };
        }

        const allowedRoles = ["Teachers", "Admins", "System"];
        const hasPermission = userRole?.split(",").some(role => allowedRoles.includes(role.trim()));

        if (!hasPermission) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Forbidden: Only teachers, admins, or system can grade attempts" }),
            };
        }

        // Parse request body
        const body = JSON.parse(event.body || "{}");

        const {
            is_correct,
            grader_type,
            auto_grade_result,
            teacher_grade_status,
            xp_awarded,
            gold_awarded,
            reward_txn_id,
        } = body;

        // Validate input
        const validation = validateGradeAttemptData({
            is_correct,
            grader_type,
            teacher_grade_status,
            xp_awarded,
            gold_awarded,
            reward_txn_id,
            auto_grade_result,
        });

        if (!validation.valid) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: validation.error }),
            };
        }

        // Set graded_at timestamp
        const graded_at = new Date().toISOString();

        // Update grading fields
        await updateAttemptGrade(
            quest_instance_id,
            student_id,
            question_id,
            attempt_no,
            {
                is_correct,
                grader_type,
                auto_grade_result,
                teacher_grade_status,
                graded_at,
                xp_awarded,
                gold_awarded,
                reward_txn_id,
            }
        );

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Attempt graded successfully",
                graded_at,
            }),
        };
    } catch (error: any) {
        console.error("Error grading quest answer attempt:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

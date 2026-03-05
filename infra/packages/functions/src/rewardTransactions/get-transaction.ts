import { getTransaction } from "./repo.js";
import { getAuthContext } from "../shared/auth.js"; // Reuse the same auth context extraction logic as other endpoints

/**
 * GET /reward-transactions/{transaction_id}
 * Get a single transaction by ID
 *
 * Authorization: TEACHER, ADMIN, SYSTEM, STUDENT (students can only view their own transactions)
 */
export const handler = async (event: any) => {
    try {
        const transaction_id = event.pathParameters?.transaction_id;

        if (!transaction_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing transaction_id path parameter" }),
            };
        }

        // Extract and validate JWT token
        let auth;
        try {
            auth = await getAuthContext(event);
        } catch (err: any) {
            return {
                statusCode: err.statusCode || 401,
                body: JSON.stringify({ error: err.message }),
            };
        }

        const transaction = await getTransaction(transaction_id);

        if (!transaction) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Transaction not found" }),
            };
        }

        // Authorization: Students can only view their own transactions
        const isStudent = auth.role === "student";
        if (isStudent && transaction.student_id !== auth.sub) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Forbidden: You can only view your own transactions" }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(transaction),
        };
    } catch (error: any) {
        console.error("Error getting reward transaction:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

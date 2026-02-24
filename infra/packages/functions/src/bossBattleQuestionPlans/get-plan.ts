/**
 * GET /bossBattleQuestionPlans/{plan_id}
 * Get question plan by ID (debugging)
 */

import { getQuestionPlan } from "./repo.js";

export const handler = async (event: any) => {
    try {
        const planId = event.pathParameters?.plan_id;
        if (!planId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "plan_id is required" }),
            };
        }

        // TODO: Authorization - TEACHER only

        const plan = await getQuestionPlan(planId);

        if (!plan) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Question plan not found" }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(plan),
        };
    } catch (error: any) {
        console.error("Error getting question plan:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

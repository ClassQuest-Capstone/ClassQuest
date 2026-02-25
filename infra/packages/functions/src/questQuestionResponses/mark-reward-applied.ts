import { markRewardApplied } from "./repo.js";
import { validateSummaryAndRewardFields } from "./validation.js";

/**
 * Internal route to mark reward as applied
 * Should be restricted to service/admin access only
 * POST /internal/quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/reward-applied
 */
export const handler = async (event: any) => {
    // TODO AUTH: Restrict to service account or admin only

    const quest_instance_id = event.pathParameters?.quest_instance_id;
    const question_id = event.pathParameters?.question_id;
    const student_id = event.pathParameters?.student_id;

    if (!quest_instance_id || !question_id || !student_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "Missing required path parameters: quest_instance_id, question_id, student_id"
            }),
        };
    }

    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : (rawBody ?? {});

    // Validate required fields
    if (!body.reward_txn_id || !body.reward_txn_id.trim()) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "reward_txn_id is required" }),
        };
    }

    if (body.xp_awarded_total === undefined || body.gold_awarded_total === undefined) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "xp_awarded_total and gold_awarded_total are required" }),
        };
    }

    // Validate fields
    const validation = validateSummaryAndRewardFields({
        xp_awarded_total: body.xp_awarded_total,
        gold_awarded_total: body.gold_awarded_total,
        reward_txn_id: body.reward_txn_id,
    });

    if (!validation.valid) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: validation.error }),
        };
    }

    try {
        await markRewardApplied(
            quest_instance_id,
            student_id,
            question_id,
            body.reward_txn_id,
            body.xp_awarded_total,
            body.gold_awarded_total
        );

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ok: true,
                message: "Reward marked as applied"
            }),
        };
    } catch (error: any) {
        console.error("Error marking reward as applied:", error);

        // Handle conditional check failure (already applied with same txn_id)
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Reward already applied with this transaction ID or response not found"
                }),
            };
        }

        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "Internal server error" }),
        };
    }
};

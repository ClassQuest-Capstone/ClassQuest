import { markRewardReversed } from "./repo.js";
import { validateRewardTxnId } from "./validation.js";

/**
 * Internal route to mark reward as reversed
 * Should be restricted to service/admin access only
 * POST /internal/quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/reward-reversed
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

    // Validate reward_txn_id
    const validation = validateRewardTxnId(body.reward_txn_id);
    if (!validation.valid) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: validation.error }),
        };
    }

    try {
        await markRewardReversed(
            quest_instance_id,
            student_id,
            question_id,
            body.reward_txn_id
        );

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ok: true,
                message: "Reward marked as reversed"
            }),
        };
    } catch (error: any) {
        console.error("Error marking reward as reversed:", error);

        // Handle conditional check failure (txn_id mismatch or not found)
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Response not found or reward_txn_id mismatch"
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

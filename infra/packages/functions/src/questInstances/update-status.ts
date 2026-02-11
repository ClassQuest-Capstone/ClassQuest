import { updateStatus } from "./repo.ts";
import type { QuestInstanceStatus } from "./types.ts";

const VALID_STATUSES: QuestInstanceStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];

/**
 * PATCH /quest-instances/{quest_instance_id}/status
 * Update quest instance status
 */
export const handler = async (event: any) => {
    const quest_instance_id = event.pathParameters?.quest_instance_id;

    if (!quest_instance_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_QUEST_INSTANCE_ID" }),
        };
    }

    // Parse request body
    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : rawBody ?? {};

    const { status } = body;

    // Validate status
    if (!status || !VALID_STATUSES.includes(status as QuestInstanceStatus)) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_STATUS",
                message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
            }),
        };
    }

    try {
        await updateStatus(quest_instance_id, status as QuestInstanceStatus);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                message: "Quest instance status updated successfully",
                quest_instance_id,
                status,
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "QUEST_INSTANCE_NOT_FOUND" }),
            };
        }

        console.error("Error updating quest instance status:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

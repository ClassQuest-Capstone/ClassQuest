import { randomUUID } from "crypto";
import { createInstance } from "./repo.ts";
import type { QuestInstanceStatus } from "./types.ts";

const VALID_STATUSES: QuestInstanceStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];

/**
 * POST /classes/{class_id}/quest-instances
 * Create a new quest instance for a class
 */
export const handler = async (event: any) => {
    const class_id = event.pathParameters?.class_id;

    if (!class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_CLASS_ID" }),
        };
    }

    // Parse request body
    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : rawBody ?? {};

    const {
        quest_template_id,
        title_override,
        description_override,
        start_date,
        due_date,
        requires_manual_approval,
        status,
    } = body;

    // Validate requires_manual_approval (required field)
    if (typeof requires_manual_approval !== "boolean") {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_REQUIRED_FIELD",
                message: "requires_manual_approval must be a boolean",
            }),
        };
    }

    // Validate status if provided
    const finalStatus: QuestInstanceStatus = status ?? "DRAFT";
    if (!VALID_STATUSES.includes(finalStatus)) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_STATUS",
                message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
            }),
        };
    }

    // Validate dates if provided
    if (start_date !== undefined && start_date !== null) {
        const startDateObj = new Date(start_date);
        if (isNaN(startDateObj.getTime())) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "INVALID_START_DATE",
                    message: "start_date must be a valid ISO date string",
                }),
            };
        }
    }

    if (due_date !== undefined && due_date !== null) {
        const dueDateObj = new Date(due_date);
        if (isNaN(dueDateObj.getTime())) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "INVALID_DUE_DATE",
                    message: "due_date must be a valid ISO date string",
                }),
            };
        }

        // Validate due_date >= start_date if both provided
        if (start_date !== undefined && start_date !== null) {
            const startDateObj = new Date(start_date);
            if (dueDateObj < startDateObj) {
                return {
                    statusCode: 400,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        error: "INVALID_DATE_RANGE",
                        message: "due_date must be greater than or equal to start_date",
                    }),
                };
            }
        }
    }

    // Create quest instance
    const quest_instance_id = randomUUID();
    const now = new Date().toISOString();

    const item = {
        quest_instance_id,
        quest_template_id: quest_template_id ?? null,
        class_id,
        title_override,
        description_override,
        status: finalStatus,
        start_date,
        due_date,
        requires_manual_approval,
        created_at: now,
        updated_at: now,
    };

    try {
        await createInstance(item);

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                quest_instance_id,
                message: "Quest instance created successfully",
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "QUEST_INSTANCE_ALREADY_EXISTS" }),
            };
        }

        console.error("Error creating quest instance:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

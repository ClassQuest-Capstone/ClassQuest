import { updateDates } from "./repo.ts";

/**
 * PATCH /quest-instances/{quest_instance_id}/dates
 * Update quest instance start_date and due_date
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

    const { start_date, due_date } = body;

    // Validate start_date if provided and not null
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

    // Validate due_date if provided and not null
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

        // Validate due_date >= start_date if both provided and not null
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

    // Check if at least one date is provided
    if (start_date === undefined && due_date === undefined) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "NO_DATES_PROVIDED",
                message: "At least one of start_date or due_date must be provided",
            }),
        };
    }

    try {
        await updateDates(quest_instance_id, start_date, due_date);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                message: "Quest instance dates updated successfully",
                quest_instance_id,
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

        console.error("Error updating quest instance dates:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }),
        };
    }
};

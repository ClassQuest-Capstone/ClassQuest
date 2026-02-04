import { randomUUID } from "crypto";
import type { QuestQuestionItem, QuestionFormat } from "./types.ts";
import { createQuestion } from "./repo.ts";
import { toOrderKey } from "./orderKey.ts";
import {
    normalizeQuestionFormat,
    validateQuestionFormat,
    validateQuestion,
} from "./validation.ts";
import { mapFormatToLegacyType } from "./types.ts";

/**
 * POST /quest-templates/{template_id}/questions
 * Create a new question for a quest template
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify user is owner of the quest template

    // Step 1: Extract template_id from path
    const quest_template_id = event.pathParameters?.template_id;

    if (!quest_template_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_TEMPLATE_ID" }),
        };
    }

    // Step 2: Parse request body
    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : rawBody ?? {};

    const {
        order_index,
        question_type,      // Legacy support
        question_format,    // Preferred
        prompt,
        options,
        correct_answer,
        max_points,
        auto_gradable,
        rubric_text,
        difficulty,
        hint,
        explanation,
        time_limit_seconds,
    } = body;

    // Step 3: Normalize question_format (accept legacy question_type)
    const normalizedFormat = normalizeQuestionFormat({ question_type, question_format });

    if (!normalizedFormat) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_QUESTION_FORMAT",
                message: "Either question_format or question_type is required",
            }),
        };
    }

    // Step 4: Validate question_format
    const formatValidation = validateQuestionFormat(normalizedFormat);
    if (!formatValidation.valid) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_QUESTION_FORMAT",
                message: formatValidation.error,
            }),
        };
    }

    // Step 5: Validate required fields
    if (
        order_index === undefined ||
        !prompt ||
        max_points === undefined ||
        auto_gradable === undefined
    ) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_REQUIRED_FIELDS",
                message:
                    "Required fields: order_index, question_format (or question_type), prompt, max_points, auto_gradable",
            }),
        };
    }

    // Step 6: Comprehensive validation
    const validation = validateQuestion({
        question_format: normalizedFormat,
        prompt,
        options,
        correct_answer,
        max_points,
        auto_gradable,
        difficulty,
        time_limit_seconds,
    });

    if (!validation.valid) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "VALIDATION_ERROR",
                message: validation.error,
            }),
        };
    }

    // Step 7: Derive order_key from order_index
    let order_key: string;
    try {
        order_key = toOrderKey(order_index);
    } catch (error: any) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_ORDER_INDEX",
                message: error.message,
            }),
        };
    }

    // Step 8: Create the question item
    const question_id = randomUUID();

    const item: QuestQuestionItem = {
        question_id,
        quest_template_id,
        order_key,
        order_index,
        question_format: normalizedFormat as QuestionFormat,
        prompt: prompt.trim(),
        options,
        correct_answer,
        max_points,
        auto_gradable,
        rubric_text,
        difficulty,
        hint,
        explanation,
        time_limit_seconds,
    };

    // Add legacy question_type for backward compatibility (optional)
    const legacyType = mapFormatToLegacyType(normalizedFormat as QuestionFormat);
    if (legacyType) {
        item.question_type = legacyType;
    }

    try {
        await createQuestion(item);

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                question_id,
                order_key,
                question_format: normalizedFormat,
                message: "Question created successfully",
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "QUESTION_ALREADY_EXISTS",
                    message: "A question with this ID already exists",
                }),
            };
        }

        console.error("Error creating question:", error);
        throw error;
    }
};

import type { QuestionFormat } from "./types.ts";
import { updateQuestion, getQuestion } from "./repo.ts";
import { toOrderKey } from "./orderKey.ts";
import {
    normalizeQuestionFormat,
    validateQuestionFormat,
    validateQuestion,
} from "./validation.ts";
import { mapFormatToLegacyType } from "./types.ts";

/**
 * PATCH /quest-questions/{question_id}
 * Update question fields
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify user is owner of the quest template

    const question_id = event.pathParameters?.question_id;

    if (!question_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_QUESTION_ID" }),
        };
    }

    // Step 1: Parse request body
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

    // Step 2: Fetch existing question to get current values for validation
    let existingQuestion;
    try {
        existingQuestion = await getQuestion(question_id);
        if (!existingQuestion) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "QUESTION_NOT_FOUND" }),
            };
        }
    } catch (error) {
        console.error("Error fetching existing question:", error);
        throw error;
    }

    // Step 3: Determine final question_format
    let finalFormat = existingQuestion.question_format;
    if (question_format || question_type) {
        const normalizedFormat = normalizeQuestionFormat({ question_type, question_format });
        if (normalizedFormat) {
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
            finalFormat = normalizedFormat as QuestionFormat;
        }
    }

    // Step 4: Build merged data for validation
    const mergedData = {
        question_format: finalFormat,
        prompt: prompt !== undefined ? prompt : existingQuestion.prompt,
        options: options !== undefined ? options : existingQuestion.options,
        correct_answer: correct_answer !== undefined ? correct_answer : existingQuestion.correct_answer,
        max_points: max_points !== undefined ? max_points : existingQuestion.max_points,
        auto_gradable: auto_gradable !== undefined ? auto_gradable : existingQuestion.auto_gradable,
        difficulty: difficulty !== undefined ? difficulty : existingQuestion.difficulty,
        time_limit_seconds: time_limit_seconds !== undefined ? time_limit_seconds : existingQuestion.time_limit_seconds,
    };

    // Step 5: Validate merged data
    const validation = validateQuestion(mergedData);
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

    // Step 6: Build updates object
    const updates: any = {};

    if (order_index !== undefined) {
        try {
            updates.order_index = order_index;
            updates.order_key = toOrderKey(order_index);
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
    }

    if (finalFormat !== existingQuestion.question_format) {
        updates.question_format = finalFormat;
        // Update legacy question_type if format changed
        const legacyType = mapFormatToLegacyType(finalFormat);
        if (legacyType) {
            updates.question_type = legacyType;
        }
    }

    if (prompt !== undefined) updates.prompt = prompt.trim();
    if (options !== undefined) updates.options = options;
    if (correct_answer !== undefined) updates.correct_answer = correct_answer;
    if (max_points !== undefined) updates.max_points = max_points;
    if (auto_gradable !== undefined) updates.auto_gradable = auto_gradable;
    if (rubric_text !== undefined) updates.rubric_text = rubric_text;
    if (difficulty !== undefined) updates.difficulty = difficulty;
    if (hint !== undefined) updates.hint = hint;
    if (explanation !== undefined) updates.explanation = explanation;
    if (time_limit_seconds !== undefined) updates.time_limit_seconds = time_limit_seconds;

    // Step 7: Perform update
    try {
        await updateQuestion(question_id, updates);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                message: "Question updated successfully",
                question_id,
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "QUESTION_NOT_FOUND" }),
            };
        }

        console.error("Error updating question:", error);
        throw error;
    }
};

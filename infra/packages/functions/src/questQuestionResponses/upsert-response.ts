import { randomUUID } from "crypto";
import { upsertResponse } from "./repo.js";
import { AutoGradeResult, QuestQuestionResponseItem, ResponseStatus } from "./types.js";
import { makeInstanceStudentPk, makeGsi1Sk, makeGsi2Sk, makeGsi3Sk } from "./keys.js";
import { validateSummaryAndRewardFields } from "./validation.js";

export const handler = async (event: any) => {
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

    // Validate required body fields
    const class_id = body.class_id;
    const answer_raw = body.answer_raw;

    if (!class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "Missing required field: class_id" }),
        };
    }

    if (!answer_raw || typeof answer_raw !== "object" || Array.isArray(answer_raw)) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "answer_raw must be an object/map" }),
        };
    }

    // Validate numeric fields >= 0
    if (body.auto_points_awarded !== undefined && body.auto_points_awarded < 0) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "auto_points_awarded must be >= 0" }),
        };
    }

    // Validate auto_grade_result is in enum
    if (body.auto_grade_result && !Object.values(AutoGradeResult).includes(body.auto_grade_result)) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: `auto_grade_result must be one of: ${Object.values(AutoGradeResult).join(", ")}`
            }),
        };
    }

    // Validate timestamps are ISO format if provided
    const submitted_at = body.submitted_at || new Date().toISOString();
    if (body.submitted_at && !isValidISODate(body.submitted_at)) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "submitted_at must be a valid ISO 8601 timestamp" }),
        };
    }

    const response_id = body.response_id || randomUUID();
    const instance_student_pk = makeInstanceStudentPk(quest_instance_id, student_id);

    // Build composite sort keys for GSIs
    const gsi1sk = makeGsi1Sk(submitted_at, student_id, question_id);
    const gsi2sk = makeGsi2Sk(submitted_at, quest_instance_id, question_id);
    const gsi3sk = makeGsi3Sk(submitted_at, student_id, quest_instance_id);

    // Validate status if provided (but don't allow reward fields from students)
    if (body.status !== undefined) {
        const statusValidation = validateSummaryAndRewardFields({ status: body.status });
        if (!statusValidation.valid) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: statusValidation.error }),
            };
        }
    }

    // Determine status: default to SUBMITTED (student is submitting)
    // Can be overridden if explicitly provided (e.g., IN_PROGRESS for draft saves)
    const status = body.status || ResponseStatus.SUBMITTED;

    const item: QuestQuestionResponseItem = {
        instance_student_pk,
        question_id,
        response_id,
        quest_instance_id,
        student_id,
        class_id,
        answer_raw,
        is_auto_graded: body.is_auto_graded ?? false,
        auto_grade_result: body.auto_grade_result,
        auto_points_awarded: body.auto_points_awarded,
        submitted_at,
        gsi1sk,
        gsi2sk,
        gsi3sk,
        // Summary counters (default to 0 for new responses)
        attempt_count: body.attempt_count ?? 0,
        wrong_attempt_count: body.wrong_attempt_count ?? 0,
        status,
        // Reward fields (default to 0, students cannot set these)
        xp_awarded_total: 0,
        gold_awarded_total: 0,
        // reward_txn_id and reward_status are undefined (not set by students)
    };

    try {
        await upsertResponse(item);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ok: true,
                response_id,
                submitted_at
            }),
        };
    } catch (error: any) {
        console.error("Error upserting response:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "Internal server error" }),
        };
    }
};

function isValidISODate(dateString: string): boolean {
    const date = new Date(dateString);
    return date.toISOString() === dateString;
}

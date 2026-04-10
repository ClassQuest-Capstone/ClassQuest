/**
 * Unit tests for questQuestionResponses handlers:
 * upsert-response, get-by-instance-and-student, grade-response,
 * list-by-instance, list-by-student, list-by-question,
 * mark-reward-applied, mark-reward-reversed
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questQuestionResponses
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock repo module (must be before dynamic imports)
// ---------------------------------------------------------------------------
vi.mock("../repo.js", () => ({
    upsertResponse: vi.fn(),
    getResponse: vi.fn(),
    listByInstance: vi.fn(),
    listByStudent: vi.fn(),
    listByQuestion: vi.fn(),
    gradeResponse: vi.fn(),
    listByInstanceAndStudent: vi.fn(),
    markRewardApplied: vi.fn(),
    markRewardReversed: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Handler references
// ---------------------------------------------------------------------------
let upsertHandler: (typeof import("../upsert-response.js"))["handler"];
let getByInstStudHandler: (typeof import("../get-by-instance-and-student.js"))["handler"];
let gradeHandler: (typeof import("../grade-response.js"))["handler"];
let listByInstanceHandler: (typeof import("../list-by-instance.js"))["handler"];
let listByStudentHandler: (typeof import("../list-by-student.js"))["handler"];
let listByQuestionHandler: (typeof import("../list-by-question.js"))["handler"];
let markAppliedHandler: (typeof import("../mark-reward-applied.js"))["handler"];
let markReversedHandler: (typeof import("../mark-reward-reversed.js"))["handler"];

let repo: typeof import("../repo.js");

beforeAll(async () => {
    process.env.QUEST_QUESTION_RESPONSES_TABLE_NAME = "test-qqr-table";
    upsertHandler = (await import("../upsert-response.js")).handler;
    getByInstStudHandler = (await import("../get-by-instance-and-student.js")).handler;
    gradeHandler = (await import("../grade-response.js")).handler;
    listByInstanceHandler = (await import("../list-by-instance.js")).handler;
    listByStudentHandler = (await import("../list-by-student.js")).handler;
    listByQuestionHandler = (await import("../list-by-question.js")).handler;
    markAppliedHandler = (await import("../mark-reward-applied.js")).handler;
    markReversedHandler = (await import("../mark-reward-reversed.js")).handler;
    repo = await import("../repo.js");
});

beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEvent(overrides: Record<string, any> = {}) {
    return {
        pathParameters: {
            quest_instance_id: "qi-1",
            question_id: "q-1",
            student_id: "s-1",
        },
        queryStringParameters: null,
        body: null,
        ...overrides,
    };
}

function makeResponseItem() {
    return {
        instance_student_pk: "qi-1#s-1",
        question_id: "q-1",
        response_id: "resp-uuid",
        quest_instance_id: "qi-1",
        student_id: "s-1",
        class_id: "class-1",
        answer_raw: { text: "answer" },
        is_auto_graded: false,
        submitted_at: "2024-01-01T00:00:00.000Z",
        gsi1sk: "2024-01-01T00:00:00.000Z#s-1#q-1",
        gsi2sk: "2024-01-01T00:00:00.000Z#qi-1#q-1",
        gsi3sk: "2024-01-01T00:00:00.000Z#s-1#qi-1",
        attempt_count: 0,
        wrong_attempt_count: 0,
        status: "SUBMITTED",
        xp_awarded_total: 0,
        gold_awarded_total: 0,
    };
}

// ---------------------------------------------------------------------------
// upsert-response handler
// ---------------------------------------------------------------------------
describe("upsert-response handler", () => {
    it("returns 400 when quest_instance_id missing", async () => {
        const event = makeEvent({ pathParameters: { question_id: "q-1", student_id: "s-1" } });
        const res = await upsertHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when class_id missing from body", async () => {
        const event = makeEvent({ body: JSON.stringify({ answer_raw: { text: "ans" } }) });
        const res = await upsertHandler(event);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("class_id");
    });

    it("returns 400 when answer_raw is missing", async () => {
        const event = makeEvent({ body: JSON.stringify({ class_id: "class-1" }) });
        const res = await upsertHandler(event);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("answer_raw");
    });

    it("returns 400 when answer_raw is an array", async () => {
        const event = makeEvent({
            body: JSON.stringify({ class_id: "class-1", answer_raw: ["a", "b"] }),
        });
        const res = await upsertHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when auto_points_awarded is negative", async () => {
        const event = makeEvent({
            body: JSON.stringify({
                class_id: "class-1",
                answer_raw: { text: "ans" },
                auto_points_awarded: -1,
            }),
        });
        const res = await upsertHandler(event);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("auto_points_awarded");
    });

    it("returns 400 when auto_grade_result is invalid", async () => {
        const event = makeEvent({
            body: JSON.stringify({
                class_id: "class-1",
                answer_raw: { text: "ans" },
                auto_grade_result: "MAYBE",
            }),
        });
        const res = await upsertHandler(event);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("auto_grade_result");
    });

    it("returns 400 when submitted_at is not valid ISO", async () => {
        // "2024-01-01" parses but doesn't round-trip to the same string
        const event = makeEvent({
            body: JSON.stringify({
                class_id: "class-1",
                answer_raw: { text: "ans" },
                submitted_at: "2024-01-01",
            }),
        });
        const res = await upsertHandler(event);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("submitted_at");
    });

    it("returns 400 when status is invalid", async () => {
        const event = makeEvent({
            body: JSON.stringify({
                class_id: "class-1",
                answer_raw: { text: "ans" },
                status: "DONE",
            }),
        });
        const res = await upsertHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 200 with response_id and submitted_at on success", async () => {
        vi.mocked(repo.upsertResponse).mockResolvedValueOnce(undefined);

        const event = makeEvent({
            body: JSON.stringify({
                class_id: "class-1",
                answer_raw: { text: "answer" },
            }),
        });
        const res = await upsertHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.ok).toBe(true);
        expect(body.response_id).toBeDefined();
        expect(body.submitted_at).toBeDefined();
    });

    it("returns 500 when upsertResponse throws", async () => {
        vi.mocked(repo.upsertResponse).mockRejectedValueOnce(new Error("DDB error"));
        const event = makeEvent({
            body: JSON.stringify({ class_id: "class-1", answer_raw: { text: "ans" } }),
        });
        const res = await upsertHandler(event);
        expect(res.statusCode).toBe(500);
    });

    it("accepts body as object (non-string)", async () => {
        vi.mocked(repo.upsertResponse).mockResolvedValueOnce(undefined);
        const event = makeEvent({ body: { class_id: "class-1", answer_raw: { text: "ans" } } });
        const res = await upsertHandler(event);
        expect(res.statusCode).toBe(200);
    });

    it("defaults status to SUBMITTED", async () => {
        let capturedItem: any;
        vi.mocked(repo.upsertResponse).mockImplementationOnce(async (item) => {
            capturedItem = item;
        });
        const event = makeEvent({
            body: JSON.stringify({ class_id: "class-1", answer_raw: { text: "ans" } }),
        });
        await upsertHandler(event);
        expect(capturedItem.status).toBe("SUBMITTED");
    });
});

// ---------------------------------------------------------------------------
// get-by-instance-and-student handler
// ---------------------------------------------------------------------------
describe("get-by-instance-and-student handler", () => {
    it("returns 400 when quest_instance_id missing", async () => {
        const event = makeEvent({ pathParameters: { student_id: "s-1" } });
        const res = await getByInstStudHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when student_id missing", async () => {
        const event = makeEvent({ pathParameters: { quest_instance_id: "qi-1" } });
        const res = await getByInstStudHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 200 with responses array", async () => {
        vi.mocked(repo.listByInstanceAndStudent).mockResolvedValueOnce({
            items: [makeResponseItem() as any],
            cursor: undefined,
        });
        const event = makeEvent();
        const res = await getByInstStudHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.ok).toBe(true);
        expect(body.responses).toHaveLength(1);
        expect(body.count).toBe(1);
    });

    it("passes limit from queryStringParameters", async () => {
        vi.mocked(repo.listByInstanceAndStudent).mockResolvedValueOnce({ items: [], cursor: undefined });
        const event = makeEvent({ queryStringParameters: { limit: "5" } });
        await getByInstStudHandler(event);
        expect(vi.mocked(repo.listByInstanceAndStudent)).toHaveBeenCalledWith("qi-1", "s-1", 5, undefined);
    });

    it("returns 500 on error", async () => {
        vi.mocked(repo.listByInstanceAndStudent).mockRejectedValueOnce(new Error("fail"));
        const event = makeEvent();
        const res = await getByInstStudHandler(event);
        expect(res.statusCode).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// grade-response handler
// ---------------------------------------------------------------------------
describe("grade-response handler", () => {
    it("returns 400 when path params missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await gradeHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when teacher_points_awarded is negative", async () => {
        const event = makeEvent({
            body: JSON.stringify({ teacher_points_awarded: -5 }),
        });
        const res = await gradeHandler(event);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("teacher_points_awarded");
    });

    it("returns 400 when xp_awarded_total is invalid", async () => {
        const event = makeEvent({
            body: JSON.stringify({ xp_awarded_total: -10 }),
        });
        const res = await gradeHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 200 with graded_at on success", async () => {
        vi.mocked(repo.gradeResponse).mockResolvedValueOnce(undefined);
        const event = makeEvent({
            body: JSON.stringify({ teacher_points_awarded: 10, graded_by_teacher_id: "t-1" }),
        });
        const res = await gradeHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.ok).toBe(true);
        expect(body.graded_at).toBeDefined();
    });

    it("returns 404 on ConditionalCheckFailedException", async () => {
        const err = Object.assign(new Error("cond"), { name: "ConditionalCheckFailedException" });
        vi.mocked(repo.gradeResponse).mockRejectedValueOnce(err);
        const event = makeEvent({ body: JSON.stringify({}) });
        const res = await gradeHandler(event);
        expect(res.statusCode).toBe(404);
    });

    it("returns 500 on other errors", async () => {
        vi.mocked(repo.gradeResponse).mockRejectedValueOnce(new Error("ddb error"));
        const event = makeEvent({ body: JSON.stringify({}) });
        const res = await gradeHandler(event);
        expect(res.statusCode).toBe(500);
    });

    it("sets reward_status=PENDING when xp > 0", async () => {
        let capturedPatch: any;
        vi.mocked(repo.gradeResponse).mockImplementationOnce(async (_qi, _si, _qi2, patch) => {
            capturedPatch = patch;
        });
        const event = makeEvent({ body: JSON.stringify({ xp_awarded_total: 50 }) });
        await gradeHandler(event);
        expect(capturedPatch.reward_status).toBe("PENDING");
    });

    it("defaults status to GRADED", async () => {
        let capturedPatch: any;
        vi.mocked(repo.gradeResponse).mockImplementationOnce(async (_qi, _si, _qi2, patch) => {
            capturedPatch = patch;
        });
        const event = makeEvent({ body: JSON.stringify({ teacher_points_awarded: 5 }) });
        await gradeHandler(event);
        expect(capturedPatch.status).toBe("GRADED");
    });
});

// ---------------------------------------------------------------------------
// list-by-instance handler
// ---------------------------------------------------------------------------
describe("list-by-instance handler", () => {
    it("returns 400 when quest_instance_id missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await listByInstanceHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 200 with normalized responses", async () => {
        vi.mocked(repo.listByInstance).mockResolvedValueOnce({
            items: [makeResponseItem() as any],
            cursor: undefined,
        });
        const event = makeEvent({ pathParameters: { quest_instance_id: "qi-1" } });
        const res = await listByInstanceHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.ok).toBe(true);
        expect(body.count).toBe(1);
    });

    it("passes limit and cursor", async () => {
        vi.mocked(repo.listByInstance).mockResolvedValueOnce({ items: [], cursor: undefined });
        const cursor = Buffer.from(JSON.stringify({ pk: "a" })).toString("base64");
        const event = makeEvent({
            pathParameters: { quest_instance_id: "qi-1" },
            queryStringParameters: { limit: "10", cursor },
        });
        await listByInstanceHandler(event);
        expect(vi.mocked(repo.listByInstance)).toHaveBeenCalledWith("qi-1", 10, cursor);
    });

    it("returns 500 on error", async () => {
        vi.mocked(repo.listByInstance).mockRejectedValueOnce(new Error("fail"));
        const event = makeEvent({ pathParameters: { quest_instance_id: "qi-1" } });
        const res = await listByInstanceHandler(event);
        expect(res.statusCode).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// list-by-student handler
// ---------------------------------------------------------------------------
describe("list-by-student handler", () => {
    it("returns 400 when student_id missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await listByStudentHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 200 with responses", async () => {
        vi.mocked(repo.listByStudent).mockResolvedValueOnce({
            items: [makeResponseItem() as any],
            cursor: undefined,
        });
        const event = makeEvent({ pathParameters: { student_id: "s-1" } });
        const res = await listByStudentHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.count).toBe(1);
    });

    it("returns 500 on error", async () => {
        vi.mocked(repo.listByStudent).mockRejectedValueOnce(new Error("fail"));
        const event = makeEvent({ pathParameters: { student_id: "s-1" } });
        const res = await listByStudentHandler(event);
        expect(res.statusCode).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// list-by-question handler
// ---------------------------------------------------------------------------
describe("list-by-question handler", () => {
    it("returns 400 when question_id missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await listByQuestionHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 200 with responses", async () => {
        vi.mocked(repo.listByQuestion).mockResolvedValueOnce({
            items: [makeResponseItem() as any],
            cursor: undefined,
        });
        const event = makeEvent({ pathParameters: { question_id: "q-1" } });
        const res = await listByQuestionHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.count).toBe(1);
    });

    it("returns 500 on error", async () => {
        vi.mocked(repo.listByQuestion).mockRejectedValueOnce(new Error("fail"));
        const event = makeEvent({ pathParameters: { question_id: "q-1" } });
        const res = await listByQuestionHandler(event);
        expect(res.statusCode).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// mark-reward-applied handler
// ---------------------------------------------------------------------------
describe("mark-reward-applied handler", () => {
    it("returns 400 when path params missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await markAppliedHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when reward_txn_id missing", async () => {
        const event = makeEvent({
            body: JSON.stringify({ xp_awarded_total: 10, gold_awarded_total: 5 }),
        });
        const res = await markAppliedHandler(event);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("reward_txn_id");
    });

    it("returns 400 when reward_txn_id is whitespace", async () => {
        const event = makeEvent({
            body: JSON.stringify({ reward_txn_id: "   ", xp_awarded_total: 10, gold_awarded_total: 5 }),
        });
        const res = await markAppliedHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when xp_awarded_total missing", async () => {
        const event = makeEvent({
            body: JSON.stringify({ reward_txn_id: "txn-abc", gold_awarded_total: 5 }),
        });
        const res = await markAppliedHandler(event);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("xp_awarded_total");
    });

    it("returns 400 when xp_awarded_total is negative", async () => {
        const event = makeEvent({
            body: JSON.stringify({ reward_txn_id: "txn-abc", xp_awarded_total: -1, gold_awarded_total: 0 }),
        });
        const res = await markAppliedHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 200 on success", async () => {
        vi.mocked(repo.markRewardApplied).mockResolvedValueOnce(undefined);
        const event = makeEvent({
            body: JSON.stringify({ reward_txn_id: "txn-abc", xp_awarded_total: 50, gold_awarded_total: 10 }),
        });
        const res = await markAppliedHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.ok).toBe(true);
        expect(body.message).toContain("applied");
    });

    it("returns 409 on ConditionalCheckFailedException", async () => {
        const err = Object.assign(new Error("cond"), { name: "ConditionalCheckFailedException" });
        vi.mocked(repo.markRewardApplied).mockRejectedValueOnce(err);
        const event = makeEvent({
            body: JSON.stringify({ reward_txn_id: "txn-abc", xp_awarded_total: 50, gold_awarded_total: 10 }),
        });
        const res = await markAppliedHandler(event);
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toContain("already applied");
    });

    it("returns 500 on other errors", async () => {
        vi.mocked(repo.markRewardApplied).mockRejectedValueOnce(new Error("ddb"));
        const event = makeEvent({
            body: JSON.stringify({ reward_txn_id: "txn-abc", xp_awarded_total: 50, gold_awarded_total: 10 }),
        });
        const res = await markAppliedHandler(event);
        expect(res.statusCode).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// mark-reward-reversed handler
// ---------------------------------------------------------------------------
describe("mark-reward-reversed handler", () => {
    it("returns 400 when path params missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await markReversedHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when reward_txn_id missing", async () => {
        const event = makeEvent({ body: JSON.stringify({}) });
        const res = await markReversedHandler(event);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("reward_txn_id");
    });

    it("returns 400 when reward_txn_id is whitespace", async () => {
        const event = makeEvent({ body: JSON.stringify({ reward_txn_id: "  " }) });
        const res = await markReversedHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 200 on success", async () => {
        vi.mocked(repo.markRewardReversed).mockResolvedValueOnce(undefined);
        const event = makeEvent({ body: JSON.stringify({ reward_txn_id: "txn-abc" }) });
        const res = await markReversedHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.ok).toBe(true);
        expect(body.message).toContain("reversed");
    });

    it("returns 404 on ConditionalCheckFailedException", async () => {
        const err = Object.assign(new Error("cond"), { name: "ConditionalCheckFailedException" });
        vi.mocked(repo.markRewardReversed).mockRejectedValueOnce(err);
        const event = makeEvent({ body: JSON.stringify({ reward_txn_id: "txn-abc" }) });
        const res = await markReversedHandler(event);
        expect(res.statusCode).toBe(404);
    });

    it("returns 500 on other errors", async () => {
        vi.mocked(repo.markRewardReversed).mockRejectedValueOnce(new Error("ddb"));
        const event = makeEvent({ body: JSON.stringify({ reward_txn_id: "txn-abc" }) });
        const res = await markReversedHandler(event);
        expect(res.statusCode).toBe(500);
    });
});

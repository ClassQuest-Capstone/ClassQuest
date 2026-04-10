/**
 * Unit tests for bossQuestions handlers:
 *   - create.ts
 *   - get.ts
 *   - delete.ts
 *   - update.ts
 *   - list-by-template.ts
 *
 * Repo is mocked; keys.ts and validation.ts run for real (pure functions).
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/bossQuestions
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock bossQuestions repo
// ---------------------------------------------------------------------------
const mockCreateQuestion  = vi.fn();
const mockGetQuestion     = vi.fn();
const mockUpdateQuestion  = vi.fn();
const mockDeleteQuestion  = vi.fn();
const mockListByTemplate  = vi.fn();

vi.mock("../repo.ts", () => ({
    createQuestion:  (...args: any[]) => mockCreateQuestion(...args),
    getQuestion:     (...args: any[]) => mockGetQuestion(...args),
    updateQuestion:  (...args: any[]) => mockUpdateQuestion(...args),
    deleteQuestion:  (...args: any[]) => mockDeleteQuestion(...args),
    listByTemplate:  (...args: any[]) => mockListByTemplate(...args),
}));

// ---------------------------------------------------------------------------
// Mock bossBattleTemplates repo — used only by create.ts
// ---------------------------------------------------------------------------
const mockGetTemplate = vi.fn();

vi.mock("../../bossBattleTemplates/repo.ts", () => ({
    getTemplate: (...args: any[]) => mockGetTemplate(...args),
}));

// ---------------------------------------------------------------------------
// Module references
// ---------------------------------------------------------------------------
let createHandler:          (typeof import("../create.ts"))["handler"];
let getHandler:             (typeof import("../get.ts"))["handler"];
let deleteHandler:          (typeof import("../delete.ts"))["handler"];
let updateHandler:          (typeof import("../update.ts"))["handler"];
let listByTemplateHandler:  (typeof import("../list-by-template.ts"))["handler"];

beforeAll(async () => {
    createHandler         = (await import("../create.ts")).handler;
    getHandler            = (await import("../get.ts")).handler;
    deleteHandler         = (await import("../delete.ts")).handler;
    updateHandler         = (await import("../update.ts")).handler;
    listByTemplateHandler = (await import("../list-by-template.ts")).handler;
});

beforeEach(() => {
    mockCreateQuestion.mockReset();
    mockGetQuestion.mockReset();
    mockUpdateQuestion.mockReset();
    mockDeleteQuestion.mockReset();
    mockListByTemplate.mockReset();
    mockGetTemplate.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTemplateItem(overrides: Record<string, any> = {}) {
    return {
        boss_template_id:   "tpl-1",
        owner_teacher_id:   "teacher-1",
        title:              "Dragon Boss",
        is_deleted:         false,
        ...overrides,
    };
}

function makeQuestionItem(overrides: Record<string, any> = {}) {
    return {
        question_id:                  "q-1",
        boss_template_id:             "tpl-1",
        order_index:                  0,
        order_key:                    "000000",
        question_text:                "What is 2+2?",
        question_type:                "MCQ_SINGLE",
        options:                      ["1", "2", "4", "8"],
        correct_answer:               "4",
        damage_to_boss_on_correct:    100,
        damage_to_guild_on_incorrect: 50,
        auto_gradable:                true,
        created_at:                   "2026-04-09T10:00:00.000Z",
        updated_at:                   "2026-04-09T10:00:00.000Z",
        ...overrides,
    };
}

function makeValidCreateBody(overrides: Record<string, any> = {}) {
    return {
        order_index:                  0,
        question_text:                "What is 2+2?",
        question_type:                "MCQ_SINGLE",
        options:                      ["1", "2", "4", "8"],
        correct_answer:               "4",
        damage_to_boss_on_correct:    100,
        damage_to_guild_on_incorrect: 50,
        auto_gradable:                true,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// create handler
// ---------------------------------------------------------------------------
describe("create handler", () => {
    it("returns 201 with question_id, order_key, and message on success", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplateItem());
        mockCreateQuestion.mockResolvedValue(undefined);

        const res = await createHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            body: JSON.stringify(makeValidCreateBody()),
        } as any);

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.question_id).toBeTruthy();
        expect(body.order_key).toBe("000000");
        expect(body.message).toContain("created");
    });

    it("returns 400 when boss_template_id is missing from path", async () => {
        const res = await createHandler({
            pathParameters: undefined,
            body: JSON.stringify(makeValidCreateBody()),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("boss_template_id");
        expect(mockGetTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 when order_index is missing", async () => {
        const res = await createHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            body: JSON.stringify(makeValidCreateBody({ order_index: undefined })),
        } as any);

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.required).toContain("order_index");
        expect(mockCreateQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when question_text is missing", async () => {
        const res = await createHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            body: JSON.stringify(makeValidCreateBody({ question_text: undefined })),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(mockCreateQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when question_type is missing", async () => {
        const res = await createHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            body: JSON.stringify(makeValidCreateBody({ question_type: undefined })),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(mockCreateQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when auto_gradable is missing", async () => {
        const res = await createHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            body: JSON.stringify(makeValidCreateBody({ auto_gradable: undefined })),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(mockCreateQuestion).not.toHaveBeenCalled();
    });

    it("returns 404 when boss template is not found", async () => {
        mockGetTemplate.mockResolvedValue(null);

        const res = await createHandler({
            pathParameters: { boss_template_id: "missing-tpl" },
            body: JSON.stringify(makeValidCreateBody()),
        } as any);

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toContain("not found");
        expect(mockCreateQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when validation fails — invalid question_type", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplateItem());

        const res = await createHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            body: JSON.stringify(makeValidCreateBody({ question_type: "INVALID_TYPE" })),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("question_type");
        expect(mockCreateQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when auto_gradable=true but correct_answer is absent", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplateItem());

        const res = await createHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            body: JSON.stringify(makeValidCreateBody({ auto_gradable: true, correct_answer: undefined })),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("correct_answer");
        expect(mockCreateQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when order_index exceeds 999999 (makeOrderKey throws)", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplateItem());

        const res = await createHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            body: JSON.stringify(makeValidCreateBody({ order_index: 1000000 })),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("999999");
        expect(mockCreateQuestion).not.toHaveBeenCalled();
    });

    it("returns 409 when ConditionalCheckFailedException is thrown", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplateItem());
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockCreateQuestion.mockRejectedValue(err);

        const res = await createHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            body: JSON.stringify(makeValidCreateBody()),
        } as any);

        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toContain("already exists");
    });

    it("returns 500 on unexpected repo error", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplateItem());
        mockCreateQuestion.mockRejectedValue(new Error("DynamoDB unavailable"));

        const res = await createHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            body: JSON.stringify(makeValidCreateBody()),
        } as any);

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("DynamoDB unavailable");
    });

    it("trims whitespace from question_text", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplateItem());
        mockCreateQuestion.mockResolvedValue(undefined);

        await createHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            body: JSON.stringify(makeValidCreateBody({ question_text: "  What is 2+2?  " })),
        } as any);

        const calledWith = mockCreateQuestion.mock.calls[0][0];
        expect(calledWith.question_text).toBe("What is 2+2?");
    });
});

// ---------------------------------------------------------------------------
// get handler
// ---------------------------------------------------------------------------
describe("get handler", () => {
    it("returns 200 with full question body on success", async () => {
        const question = makeQuestionItem();
        mockGetQuestion.mockResolvedValue(question);

        const res = await getHandler({
            pathParameters: { question_id: "q-1" },
        } as any);

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.question_id).toBe("q-1");
        expect(body.question_text).toBe("What is 2+2?");
        expect(body.question_type).toBe("MCQ_SINGLE");
    });

    it("returns 400 when question_id is missing from path", async () => {
        const res = await getHandler({ pathParameters: undefined } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("question_id");
        expect(mockGetQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when pathParameters exists but question_id is absent", async () => {
        const res = await getHandler({ pathParameters: {} } as any);

        expect(res.statusCode).toBe(400);
        expect(mockGetQuestion).not.toHaveBeenCalled();
    });

    it("returns 404 when question is not found", async () => {
        mockGetQuestion.mockResolvedValue(null);

        const res = await getHandler({
            pathParameters: { question_id: "missing" },
        } as any);

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toContain("not found");
    });

    it("returns 500 when repo throws", async () => {
        mockGetQuestion.mockRejectedValue(new Error("ServiceUnavailable"));

        const res = await getHandler({
            pathParameters: { question_id: "q-1" },
        } as any);

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("ServiceUnavailable");
    });

    it("passes question_id to repo", async () => {
        mockGetQuestion.mockResolvedValue(makeQuestionItem({ question_id: "q-xyz" }));

        await getHandler({
            pathParameters: { question_id: "q-xyz" },
        } as any);

        expect(mockGetQuestion).toHaveBeenCalledWith("q-xyz");
    });
});

// ---------------------------------------------------------------------------
// delete handler
// ---------------------------------------------------------------------------
describe("delete handler", () => {
    it("returns 204 with empty body on success", async () => {
        mockDeleteQuestion.mockResolvedValue(undefined);

        const res = await deleteHandler({
            pathParameters: { question_id: "q-1" },
        } as any);

        expect(res.statusCode).toBe(204);
        expect(res.body).toBe("");
    });

    it("returns 400 when question_id is missing from path", async () => {
        const res = await deleteHandler({ pathParameters: undefined } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("question_id");
        expect(mockDeleteQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when pathParameters exists but question_id is absent", async () => {
        const res = await deleteHandler({ pathParameters: {} } as any);

        expect(res.statusCode).toBe(400);
        expect(mockDeleteQuestion).not.toHaveBeenCalled();
    });

    it("passes question_id to repo", async () => {
        mockDeleteQuestion.mockResolvedValue(undefined);

        await deleteHandler({
            pathParameters: { question_id: "q-abc" },
        } as any);

        expect(mockDeleteQuestion).toHaveBeenCalledWith("q-abc");
    });

    it("returns 500 when repo throws", async () => {
        mockDeleteQuestion.mockRejectedValue(new Error("DynamoDB error"));

        const res = await deleteHandler({
            pathParameters: { question_id: "q-1" },
        } as any);

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("DynamoDB error");
    });
});

// ---------------------------------------------------------------------------
// update handler
// ---------------------------------------------------------------------------
describe("update handler", () => {
    it("returns 200 with question_id and message on success", async () => {
        mockUpdateQuestion.mockResolvedValue(undefined);

        const res = await updateHandler({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ question_text: "Updated text" }),
        } as any);

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.question_id).toBe("q-1");
        expect(body.message).toContain("updated");
    });

    it("returns 400 when question_id is missing from path", async () => {
        const res = await updateHandler({
            pathParameters: undefined,
            body: JSON.stringify({ question_text: "Text" }),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("question_id");
        expect(mockUpdateQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when validation fails — invalid question_type", async () => {
        const res = await updateHandler({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ question_type: "INVALID" }),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("question_type");
        expect(mockUpdateQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when validation fails — invalid time_limit_seconds", async () => {
        const res = await updateHandler({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ time_limit_seconds: 0 }),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("time_limit_seconds");
        expect(mockUpdateQuestion).not.toHaveBeenCalled();
    });

    it("returns 400 when order_index exceeds 999999 (makeOrderKey throws)", async () => {
        const res = await updateHandler({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ order_index: 1000000 }),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("999999");
        expect(mockUpdateQuestion).not.toHaveBeenCalled();
    });

    it("returns 404 when ConditionalCheckFailedException is thrown (question not found)", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockUpdateQuestion.mockRejectedValue(err);

        const res = await updateHandler({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ question_text: "Updated" }),
        } as any);

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toContain("not found");
    });

    it("returns 500 on unexpected repo error", async () => {
        mockUpdateQuestion.mockRejectedValue(new Error("DynamoDB unavailable"));

        const res = await updateHandler({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ question_text: "Updated" }),
        } as any);

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("DynamoDB unavailable");
    });

    it("trims whitespace from question_text", async () => {
        mockUpdateQuestion.mockResolvedValue(undefined);

        await updateHandler({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ question_text: "  Trimmed text  " }),
        } as any);

        const calledWith = mockUpdateQuestion.mock.calls[0][1];
        expect(calledWith.question_text).toBe("Trimmed text");
    });

    it("passes image_asset_key=null to repo (REMOVE)", async () => {
        mockUpdateQuestion.mockResolvedValue(undefined);

        await updateHandler({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ image_asset_key: null }),
        } as any);

        const calledWith = mockUpdateQuestion.mock.calls[0][1];
        expect(calledWith.image_asset_key).toBeNull();
    });

    it("computes order_key from order_index and passes to repo", async () => {
        mockUpdateQuestion.mockResolvedValue(undefined);

        await updateHandler({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ order_index: 5 }),
        } as any);

        const calledWith = mockUpdateQuestion.mock.calls[0][1];
        expect(calledWith.order_key).toBe("000005");
        expect(calledWith.order_index).toBe(5);
    });
});

// ---------------------------------------------------------------------------
// list-by-template handler
// ---------------------------------------------------------------------------
describe("list-by-template handler", () => {
    it("returns 200 with items and cursor on success", async () => {
        mockListByTemplate.mockResolvedValue({
            items: [makeQuestionItem(), makeQuestionItem({ question_id: "q-2" })],
            cursor: "nextpagetoken==",
        });

        const res = await listByTemplateHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            queryStringParameters: {},
        } as any);

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(2);
        expect(body.cursor).toBe("nextpagetoken==");
    });

    it("returns 200 with empty items and no cursor", async () => {
        mockListByTemplate.mockResolvedValue({ items: [], cursor: undefined });

        const res = await listByTemplateHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            queryStringParameters: {},
        } as any);

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).items).toEqual([]);
    });

    it("returns 400 when boss_template_id is missing from path", async () => {
        const res = await listByTemplateHandler({
            pathParameters: undefined,
            queryStringParameters: {},
        } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("boss_template_id");
        expect(mockListByTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 when limit is 0", async () => {
        const res = await listByTemplateHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            queryStringParameters: { limit: "0" },
        } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("limit");
        expect(mockListByTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 when limit exceeds 100", async () => {
        const res = await listByTemplateHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            queryStringParameters: { limit: "101" },
        } as any);

        expect(res.statusCode).toBe(400);
        expect(mockListByTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 when limit is not a number", async () => {
        const res = await listByTemplateHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            queryStringParameters: { limit: "abc" },
        } as any);

        expect(res.statusCode).toBe(400);
        expect(mockListByTemplate).not.toHaveBeenCalled();
    });

    it("passes parsed limit as number to repo", async () => {
        mockListByTemplate.mockResolvedValue({ items: [], cursor: undefined });

        await listByTemplateHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            queryStringParameters: { limit: "20" },
        } as any);

        expect(mockListByTemplate).toHaveBeenCalledWith("tpl-1", 20, undefined);
    });

    it("passes cursor to repo", async () => {
        mockListByTemplate.mockResolvedValue({ items: [], cursor: undefined });

        await listByTemplateHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            queryStringParameters: { cursor: "abc123token" },
        } as any);

        expect(mockListByTemplate).toHaveBeenCalledWith("tpl-1", undefined, "abc123token");
    });

    it("works with no queryStringParameters", async () => {
        mockListByTemplate.mockResolvedValue({ items: [], cursor: undefined });

        const res = await listByTemplateHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            queryStringParameters: undefined,
        } as any);

        expect(res.statusCode).toBe(200);
    });

    it("returns 500 when repo throws", async () => {
        mockListByTemplate.mockRejectedValue(new Error("DynamoDB error"));

        const res = await listByTemplateHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            queryStringParameters: {},
        } as any);

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("DynamoDB error");
    });
});

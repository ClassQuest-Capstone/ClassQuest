/**
 * Unit tests for questQuestions handlers:
 * create, get, update, delete, list-by-template
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questQuestions
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock repo (before dynamic imports)
// ---------------------------------------------------------------------------
vi.mock("../repo.ts", () => ({
    createQuestion: vi.fn(),
    getQuestion:    vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
    listByTemplate: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Handler references
// ---------------------------------------------------------------------------
let createHandler:       (typeof import("../create.ts"))["handler"];
let getHandler:          (typeof import("../get.ts"))["handler"];
let updateHandler:       (typeof import("../update.ts"))["handler"];
let deleteHandler:       (typeof import("../delete.ts"))["handler"];
let listByTmplHandler:   (typeof import("../list-by-template.ts"))["handler"];
let repo: typeof import("../repo.ts");

beforeAll(async () => {
    process.env.QUEST_QUESTIONS_TABLE_NAME = "test-questions-table";
    createHandler     = (await import("../create.ts")).handler;
    getHandler        = (await import("../get.ts")).handler;
    updateHandler     = (await import("../update.ts")).handler;
    deleteHandler     = (await import("../delete.ts")).handler;
    listByTmplHandler = (await import("../list-by-template.ts")).handler;
    repo = await import("../repo.ts");
});

beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEvent(overrides: Record<string, any> = {}) {
    return {
        pathParameters: null,
        queryStringParameters: null,
        body: null,
        ...overrides,
    };
}

function makeQuestion(overrides: Record<string, any> = {}) {
    return {
        question_id: "q-uuid-1",
        quest_template_id: "tmpl-1",
        order_key: "0001",
        order_index: 1,
        question_format: "SHORT_ANSWER",
        prompt: "What is 2+2?",
        max_points: 5,
        auto_gradable: false,
        base_xp: 0, min_xp: 0, xp_decay_per_wrong: 0,
        base_gold: 0, min_gold: 0, gold_decay_per_wrong: 0,
        decay_exempt: true,
        ...overrides,
    };
}

function validCreateBody() {
    return JSON.stringify({
        order_index: 1,
        question_format: "SHORT_ANSWER",
        prompt: "What is 2+2?",
        max_points: 5,
        auto_gradable: false,
    });
}

// ---------------------------------------------------------------------------
// create.ts
// ---------------------------------------------------------------------------
describe("create handler", () => {
    it("returns 400 when template_id missing", async () => {
        const res = await createHandler(makeEvent());
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_TEMPLATE_ID");
    });

    it("returns 400 when question_format and question_type both missing", async () => {
        const res = await createHandler(makeEvent({
            pathParameters: { template_id: "tmpl-1" },
            body: JSON.stringify({ order_index: 1, prompt: "Q", max_points: 5, auto_gradable: false }),
        }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_QUESTION_FORMAT");
    });

    it("returns 400 when question_format is invalid", async () => {
        const res = await createHandler(makeEvent({
            pathParameters: { template_id: "tmpl-1" },
            body: JSON.stringify({ question_format: "MCQ", order_index: 1, prompt: "Q", max_points: 5, auto_gradable: false }),
        }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_QUESTION_FORMAT");
    });

    it("returns 400 when required fields missing (no order_index)", async () => {
        const res = await createHandler(makeEvent({
            pathParameters: { template_id: "tmpl-1" },
            body: JSON.stringify({ question_format: "SHORT_ANSWER", prompt: "Q", max_points: 5, auto_gradable: false }),
        }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_REQUIRED_FIELDS");
    });

    it("returns 400 when validation fails (negative max_points)", async () => {
        // prompt must be non-empty to pass the MISSING_REQUIRED_FIELDS check;
        // negative max_points is caught by validateQuestion → VALIDATION_ERROR
        const res = await createHandler(makeEvent({
            pathParameters: { template_id: "tmpl-1" },
            body: JSON.stringify({ question_format: "SHORT_ANSWER", order_index: 1, prompt: "Valid prompt", max_points: -1, auto_gradable: false }),
        }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for invalid order_index (>9999)", async () => {
        const res = await createHandler(makeEvent({
            pathParameters: { template_id: "tmpl-1" },
            body: JSON.stringify({ question_format: "SHORT_ANSWER", order_index: 10000, prompt: "Q", max_points: 5, auto_gradable: false }),
        }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_ORDER_INDEX");
    });

    it("returns 201 with question_id and order_key on success", async () => {
        vi.mocked(repo.createQuestion).mockResolvedValueOnce(undefined);
        const res = await createHandler(makeEvent({
            pathParameters: { template_id: "tmpl-1" },
            body: validCreateBody(),
        }));
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.question_id).toBeDefined();
        expect(body.order_key).toBe("0001");
        expect(body.question_format).toBe("SHORT_ANSWER");
    });

    it("returns 409 on ConditionalCheckFailedException", async () => {
        const err = Object.assign(new Error("cond"), { name: "ConditionalCheckFailedException" });
        vi.mocked(repo.createQuestion).mockRejectedValueOnce(err);
        const res = await createHandler(makeEvent({
            pathParameters: { template_id: "tmpl-1" },
            body: validCreateBody(),
        }));
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toBe("QUESTION_ALREADY_EXISTS");
    });

    it("rethrows non-conditional errors", async () => {
        vi.mocked(repo.createQuestion).mockRejectedValueOnce(new Error("DDB down"));
        await expect(createHandler(makeEvent({
            pathParameters: { template_id: "tmpl-1" },
            body: validCreateBody(),
        }))).rejects.toThrow("DDB down");
    });

    it("accepts legacy question_type via normalizeQuestionFormat", async () => {
        vi.mocked(repo.createQuestion).mockResolvedValueOnce(undefined);
        const res = await createHandler(makeEvent({
            pathParameters: { template_id: "tmpl-1" },
            body: JSON.stringify({ question_type: "MCQ", order_index: 1, prompt: "Q?", max_points: 5, auto_gradable: false }),
        }));
        // MCQ_SINGLE requires options (2+ choices) for validation — will fail validation
        // This checks that legacy type mapping runs (not MCQ but MCQ_SINGLE)
        expect(res.statusCode).toBe(400); // fails MCQ options validation
        expect(JSON.parse(res.body).error).not.toBe("MISSING_QUESTION_FORMAT");
    });

    it("derives decay_exempt from format when not explicitly set", async () => {
        vi.mocked(repo.createQuestion).mockResolvedValueOnce(undefined);
        await createHandler(makeEvent({
            pathParameters: { template_id: "tmpl-1" },
            body: JSON.stringify({ question_format: "ESSAY", order_index: 1, prompt: "Q?", max_points: 5, auto_gradable: false }),
        }));
        expect(vi.mocked(repo.createQuestion)).toHaveBeenCalledTimes(1);
        const capturedItem = vi.mocked(repo.createQuestion).mock.calls[0][0];
        expect(capturedItem.decay_exempt).toBe(true); // ESSAY is decay-exempt
    });

    it("accepts body as object (not string)", async () => {
        vi.mocked(repo.createQuestion).mockResolvedValueOnce(undefined);
        const res = await createHandler(makeEvent({
            pathParameters: { template_id: "tmpl-1" },
            body: { question_format: "SHORT_ANSWER", order_index: 1, prompt: "Q?", max_points: 5, auto_gradable: false },
        }));
        expect(res.statusCode).toBe(201);
    });
});

// ---------------------------------------------------------------------------
// get.ts
// ---------------------------------------------------------------------------
describe("get handler", () => {
    it("returns 400 when question_id missing", async () => {
        const res = await getHandler(makeEvent());
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_QUESTION_ID");
    });

    it("returns 404 when question not found", async () => {
        vi.mocked(repo.getQuestion).mockResolvedValueOnce(null);
        const res = await getHandler(makeEvent({ pathParameters: { question_id: "q-1" } }));
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toBe("QUESTION_NOT_FOUND");
    });

    it("returns 200 with normalized item", async () => {
        vi.mocked(repo.getQuestion).mockResolvedValueOnce(makeQuestion() as any);
        const res = await getHandler(makeEvent({ pathParameters: { question_id: "q-uuid-1" } }));
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.question_id).toBe("q-uuid-1");
        // applyRewardDefaults: check defaults applied
        expect(body.base_xp).toBe(0);
    });

    it("applies applyRewardDefaults (fills in missing reward fields)", async () => {
        const itemWithoutRewards = { ...makeQuestion() };
        delete (itemWithoutRewards as any).base_xp;
        vi.mocked(repo.getQuestion).mockResolvedValueOnce(itemWithoutRewards as any);
        const res = await getHandler(makeEvent({ pathParameters: { question_id: "q-uuid-1" } }));
        const body = JSON.parse(res.body);
        expect(body.base_xp).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// update.ts
// ---------------------------------------------------------------------------
describe("update handler", () => {
    it("returns 400 when question_id missing", async () => {
        const res = await updateHandler(makeEvent());
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_QUESTION_ID");
    });

    it("returns 404 when question not found", async () => {
        vi.mocked(repo.getQuestion).mockResolvedValueOnce(null);
        const res = await updateHandler(makeEvent({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ prompt: "Updated" }),
        }));
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toBe("QUESTION_NOT_FOUND");
    });

    it("returns 400 for invalid question_format in update", async () => {
        vi.mocked(repo.getQuestion).mockResolvedValueOnce(makeQuestion() as any);
        const res = await updateHandler(makeEvent({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ question_format: "INVALID_FORMAT" }),
        }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_QUESTION_FORMAT");
    });

    it("returns 400 for invalid order_index", async () => {
        vi.mocked(repo.getQuestion).mockResolvedValueOnce(makeQuestion() as any);
        const res = await updateHandler(makeEvent({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ order_index: -1 }),
        }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_ORDER_INDEX");
    });

    it("returns 400 on validation error (empty prompt)", async () => {
        vi.mocked(repo.getQuestion).mockResolvedValueOnce(makeQuestion() as any);
        const res = await updateHandler(makeEvent({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ prompt: "" }),
        }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("VALIDATION_ERROR");
    });

    it("returns 200 on successful update", async () => {
        vi.mocked(repo.getQuestion).mockResolvedValueOnce(makeQuestion() as any);
        vi.mocked(repo.updateQuestion).mockResolvedValueOnce(undefined);
        const res = await updateHandler(makeEvent({
            pathParameters: { question_id: "q-uuid-1" },
            body: JSON.stringify({ prompt: "Updated prompt" }),
        }));
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.question_id).toBe("q-uuid-1");
    });

    it("returns 404 on ConditionalCheckFailedException from updateQuestion", async () => {
        vi.mocked(repo.getQuestion).mockResolvedValueOnce(makeQuestion() as any);
        const err = Object.assign(new Error("cond"), { name: "ConditionalCheckFailedException" });
        vi.mocked(repo.updateQuestion).mockRejectedValueOnce(err);
        const res = await updateHandler(makeEvent({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ prompt: "Updated" }),
        }));
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toBe("QUESTION_NOT_FOUND");
    });

    it("rethrows non-conditional errors from updateQuestion", async () => {
        vi.mocked(repo.getQuestion).mockResolvedValueOnce(makeQuestion() as any);
        vi.mocked(repo.updateQuestion).mockRejectedValueOnce(new Error("DDB down"));
        await expect(updateHandler(makeEvent({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ prompt: "Updated" }),
        }))).rejects.toThrow("DDB down");
    });

    it("rethrows errors from getQuestion", async () => {
        vi.mocked(repo.getQuestion).mockRejectedValueOnce(new Error("DDB fetch fail"));
        await expect(updateHandler(makeEvent({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({}),
        }))).rejects.toThrow("DDB fetch fail");
    });

    it("updates order_key when order_index is provided", async () => {
        vi.mocked(repo.getQuestion).mockResolvedValueOnce(makeQuestion() as any);
        vi.mocked(repo.updateQuestion).mockResolvedValueOnce(undefined);
        await updateHandler(makeEvent({
            pathParameters: { question_id: "q-1" },
            body: JSON.stringify({ order_index: 5 }),
        }));
        expect(vi.mocked(repo.updateQuestion)).toHaveBeenCalledWith(
            "q-1",
            expect.objectContaining({ order_index: 5, order_key: "0005" })
        );
    });
});

// ---------------------------------------------------------------------------
// delete.ts
// ---------------------------------------------------------------------------
describe("delete handler", () => {
    it("returns 400 when question_id missing", async () => {
        const res = await deleteHandler(makeEvent());
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_QUESTION_ID");
    });

    it("returns 200 on successful delete", async () => {
        vi.mocked(repo.deleteQuestion).mockResolvedValueOnce(undefined);
        const res = await deleteHandler(makeEvent({ pathParameters: { question_id: "q-uuid-1" } }));
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.question_id).toBe("q-uuid-1");
        expect(body.message).toContain("deleted");
    });

    it("rethrows errors from deleteQuestion", async () => {
        vi.mocked(repo.deleteQuestion).mockRejectedValueOnce(new Error("DDB down"));
        await expect(deleteHandler(makeEvent({
            pathParameters: { question_id: "q-1" },
        }))).rejects.toThrow("DDB down");
    });
});

// ---------------------------------------------------------------------------
// list-by-template.ts
// ---------------------------------------------------------------------------
describe("list-by-template handler", () => {
    it("returns 400 when template_id missing", async () => {
        const res = await listByTmplHandler(makeEvent());
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_TEMPLATE_ID");
    });

    it("returns 200 with normalized items array", async () => {
        vi.mocked(repo.listByTemplate).mockResolvedValueOnce([makeQuestion() as any]);
        const res = await listByTmplHandler(makeEvent({ pathParameters: { template_id: "tmpl-1" } }));
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.items[0].question_id).toBe("q-uuid-1");
        // applyRewardDefaults applied
        expect(body.items[0].base_xp).toBe(0);
    });

    it("returns 200 with empty items array", async () => {
        vi.mocked(repo.listByTemplate).mockResolvedValueOnce([]);
        const res = await listByTmplHandler(makeEvent({ pathParameters: { template_id: "tmpl-empty" } }));
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).items).toHaveLength(0);
    });

    it("normalizes items missing reward fields via applyRewardDefaults", async () => {
        const itemWithoutRewards = { ...makeQuestion() };
        delete (itemWithoutRewards as any).base_xp;
        vi.mocked(repo.listByTemplate).mockResolvedValueOnce([itemWithoutRewards as any]);
        const res = await listByTmplHandler(makeEvent({ pathParameters: { template_id: "tmpl-1" } }));
        const body = JSON.parse(res.body);
        expect(body.items[0].base_xp).toBe(0);
    });
});

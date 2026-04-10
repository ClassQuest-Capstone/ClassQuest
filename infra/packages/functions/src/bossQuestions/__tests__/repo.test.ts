/**
 * Unit tests for bossQuestions/repo.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/bossQuestions
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DynamoDB — captured at module init time
// ---------------------------------------------------------------------------
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: vi.fn(function () { return {}; }),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(function () { return { send: mockSend }; }),
    },
    PutCommand:    vi.fn(function (input: any) { return { input }; }),
    GetCommand:    vi.fn(function (input: any) { return { input }; }),
    QueryCommand:  vi.fn(function (input: any) { return { input }; }),
    UpdateCommand: vi.fn(function (input: any) { return { input }; }),
    DeleteCommand: vi.fn(function (input: any) { return { input }; }),
}));

// ---------------------------------------------------------------------------
// Module references — env var must be set before dynamic import
// ---------------------------------------------------------------------------
let createQuestion:  typeof import("../repo.ts").createQuestion;
let getQuestion:     typeof import("../repo.ts").getQuestion;
let listByTemplate:  typeof import("../repo.ts").listByTemplate;
let updateQuestion:  typeof import("../repo.ts").updateQuestion;
let deleteQuestion:  typeof import("../repo.ts").deleteQuestion;

beforeAll(async () => {
    process.env.BOSS_QUESTIONS_TABLE_NAME = "test-boss-questions";
    const mod = await import("../repo.ts");
    createQuestion = mod.createQuestion;
    getQuestion    = mod.getQuestion;
    listByTemplate = mod.listByTemplate;
    updateQuestion = mod.updateQuestion;
    deleteQuestion = mod.deleteQuestion;
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQuestionItem(overrides: Record<string, any> = {}) {
    return {
        question_id:                 "q-1",
        boss_template_id:            "tpl-1",
        order_index:                 0,
        order_key:                   "000000",
        question_text:               "What is 2+2?",
        question_type:               "MCQ_SINGLE",
        options:                     ["1", "2", "4", "8"],
        correct_answer:              "4",
        damage_to_boss_on_correct:   100,
        damage_to_guild_on_incorrect: 50,
        max_points:                  10,
        auto_gradable:               true,
        created_at:                  "2026-04-09T10:00:00.000Z",
        updated_at:                  "2026-04-09T10:00:00.000Z",
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// createQuestion
// ---------------------------------------------------------------------------
describe("createQuestion", () => {
    it("sends PutCommand with correct TableName", async () => {
        mockSend.mockResolvedValue({});
        const item = makeQuestionItem();

        await createQuestion(item);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-boss-questions");
    });

    it("sends PutCommand with ConditionExpression attribute_not_exists", async () => {
        mockSend.mockResolvedValue({});

        await createQuestion(makeQuestionItem());

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ConditionExpression).toContain("attribute_not_exists");
    });

    it("writes all item fields to DynamoDB", async () => {
        mockSend.mockResolvedValue({});
        const item = makeQuestionItem({ question_text: "What is 7*6?", order_index: 5 });

        await createQuestion(item);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Item.question_text).toBe("What is 7*6?");
        expect(cmd.input.Item.order_index).toBe(5);
        expect(cmd.input.Item.boss_template_id).toBe("tpl-1");
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DynamoDB unavailable"));

        await expect(createQuestion(makeQuestionItem())).rejects.toThrow("DynamoDB unavailable");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(createQuestion(makeQuestionItem())).rejects.toMatchObject({
            name: "ConditionalCheckFailedException",
        });
    });
});

// ---------------------------------------------------------------------------
// getQuestion
// ---------------------------------------------------------------------------
describe("getQuestion", () => {
    it("sends GetCommand with correct TableName and Key", async () => {
        mockSend.mockResolvedValue({ Item: makeQuestionItem() });

        await getQuestion("q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-boss-questions");
        expect(cmd.input.Key).toEqual({ question_id: "q-1" });
    });

    it("returns the item when found", async () => {
        const item = makeQuestionItem({ question_id: "q-2" });
        mockSend.mockResolvedValue({ Item: item });

        const result = await getQuestion("q-2");

        expect(result).toEqual(item);
    });

    it("returns null when item is not found", async () => {
        mockSend.mockResolvedValue({});

        const result = await getQuestion("missing");

        expect(result).toBeNull();
    });

    it("propagates errors", async () => {
        mockSend.mockRejectedValue(new Error("ServiceUnavailable"));

        await expect(getQuestion("q-1")).rejects.toThrow("ServiceUnavailable");
    });
});

// ---------------------------------------------------------------------------
// listByTemplate
// ---------------------------------------------------------------------------
describe("listByTemplate", () => {
    it("queries gsi1 with boss_template_id", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await listByTemplate("tpl-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.KeyConditionExpression).toContain("boss_template_id");
        expect(cmd.input.ExpressionAttributeValues[":tid"]).toBe("tpl-1");
    });

    it("returns items array and no cursor when no LastEvaluatedKey", async () => {
        const items = [makeQuestionItem(), makeQuestionItem({ question_id: "q-2" })];
        mockSend.mockResolvedValue({ Items: items });

        const result = await listByTemplate("tpl-1");

        expect(result.items).toHaveLength(2);
        expect(result.cursor).toBeUndefined();
    });

    it("returns base64 cursor when LastEvaluatedKey is present", async () => {
        const lek = { question_id: "q-5", boss_template_id: "tpl-1", order_key: "000005" };
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: lek });

        const result = await listByTemplate("tpl-1");

        const expected = Buffer.from(JSON.stringify(lek)).toString("base64");
        expect(result.cursor).toBe(expected);
    });

    it("decodes cursor and passes as ExclusiveStartKey", async () => {
        const lek = { question_id: "q-3", boss_template_id: "tpl-1", order_key: "000003" };
        const cursor = Buffer.from(JSON.stringify(lek)).toString("base64");
        mockSend.mockResolvedValue({ Items: [] });

        await listByTemplate("tpl-1", undefined, cursor);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lek);
    });

    it("passes limit as Limit to QueryCommand", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await listByTemplate("tpl-1", 25);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(25);
    });

    it("returns empty items array when no results", async () => {
        mockSend.mockResolvedValue({ Items: undefined });

        const result = await listByTemplate("tpl-1");

        expect(result.items).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// updateQuestion
// ---------------------------------------------------------------------------
describe("updateQuestion", () => {
    it("builds SET expression for provided fields", async () => {
        mockSend.mockResolvedValue({});

        await updateQuestion("q-1", { question_text: "Updated text", updated_at: "2026-01-01T00:00:00.000Z" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("SET");
        expect(cmd.input.UpdateExpression).toContain("#question_text");
    });

    it("uses ConditionExpression attribute_exists(question_id)", async () => {
        mockSend.mockResolvedValue({});

        await updateQuestion("q-1", { updated_at: "2026-01-01T00:00:00.000Z" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ConditionExpression).toContain("attribute_exists");
        expect(cmd.input.ConditionExpression).toContain("question_id");
    });

    it("uses REMOVE expression when image_asset_key is null", async () => {
        mockSend.mockResolvedValue({});

        await updateQuestion("q-1", { image_asset_key: null, updated_at: "2026-01-01T00:00:00.000Z" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("REMOVE");
        expect(cmd.input.UpdateExpression).toContain("#image_asset_key");
    });

    it("combines SET and REMOVE when both are needed", async () => {
        mockSend.mockResolvedValue({});

        await updateQuestion("q-1", {
            question_text: "New text",
            image_asset_key: null,
            updated_at: "2026-01-01T00:00:00.000Z",
        });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("SET");
        expect(cmd.input.UpdateExpression).toContain("REMOVE");
    });

    it("does not call DynamoDB when updates is empty (no-op)", async () => {
        await updateQuestion("q-1", {});

        expect(mockSend).not.toHaveBeenCalled();
    });

    it("passes correct Key to UpdateCommand", async () => {
        mockSend.mockResolvedValue({});

        await updateQuestion("q-99", { updated_at: "2026-01-01T00:00:00.000Z" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toEqual({ question_id: "q-99" });
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(
            updateQuestion("q-1", { updated_at: "2026-01-01T00:00:00.000Z" })
        ).rejects.toMatchObject({ name: "ConditionalCheckFailedException" });
    });
});

// ---------------------------------------------------------------------------
// deleteQuestion
// ---------------------------------------------------------------------------
describe("deleteQuestion", () => {
    it("sends DeleteCommand with correct TableName and Key", async () => {
        mockSend.mockResolvedValue({});

        await deleteQuestion("q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-boss-questions");
        expect(cmd.input.Key).toEqual({ question_id: "q-1" });
    });

    it("does not include a ConditionExpression", async () => {
        mockSend.mockResolvedValue({});

        await deleteQuestion("q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ConditionExpression).toBeUndefined();
    });

    it("propagates errors", async () => {
        mockSend.mockRejectedValue(new Error("DynamoDB error"));

        await expect(deleteQuestion("q-1")).rejects.toThrow("DynamoDB error");
    });
});

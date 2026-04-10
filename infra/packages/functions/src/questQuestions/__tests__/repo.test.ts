/**
 * Unit tests for questQuestions/repo.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questQuestions
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock AWS SDK (before dynamic import)
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
// Repo reference
// ---------------------------------------------------------------------------
let repo: typeof import("../repo.ts");

beforeAll(async () => {
    process.env.QUEST_QUESTIONS_TABLE_NAME = "test-questions-table";
    repo = await import("../repo.ts");
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeItem(overrides: Record<string, any> = {}) {
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
    } as any;
}

// ---------------------------------------------------------------------------
// createQuestion
// ---------------------------------------------------------------------------
describe("createQuestion", () => {
    it("sends PutCommand with attribute_not_exists condition", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.createQuestion(makeItem());

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-questions-table");
        expect(cmd.input.ConditionExpression).toBe("attribute_not_exists(question_id)");
        expect(cmd.input.Item.question_id).toBe("q-uuid-1");
    });
});

// ---------------------------------------------------------------------------
// getQuestion
// ---------------------------------------------------------------------------
describe("getQuestion", () => {
    it("sends GetCommand with question_id key", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeItem() });
        const result = await repo.getQuestion("q-uuid-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toEqual({ question_id: "q-uuid-1" });
        expect(result).not.toBeNull();
        expect(result?.question_id).toBe("q-uuid-1");
    });

    it("returns null when item not found", async () => {
        mockSend.mockResolvedValueOnce({});
        const result = await repo.getQuestion("nonexistent");
        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// listByTemplate
// ---------------------------------------------------------------------------
describe("listByTemplate", () => {
    it("queries gsi1 with quest_template_id condition", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeItem()] });
        const result = await repo.listByTemplate("tmpl-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.KeyConditionExpression).toContain("quest_template_id");
        expect(cmd.input.ExpressionAttributeValues[":tid"]).toBe("tmpl-1");
        expect(result).toHaveLength(1);
    });

    it("returns empty array when no items", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        const result = await repo.listByTemplate("tmpl-empty");
        expect(result).toEqual([]);
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValueOnce({});
        const result = await repo.listByTemplate("tmpl-empty");
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// updateQuestion
// ---------------------------------------------------------------------------
describe("updateQuestion", () => {
    it("sends UpdateCommand with attribute_exists condition", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateQuestion("q-uuid-1", { prompt: "New prompt" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toEqual({ question_id: "q-uuid-1" });
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(question_id)");
        expect(cmd.input.UpdateExpression).toContain("#prompt = :prompt");
        expect(cmd.input.ExpressionAttributeValues[":prompt"]).toBe("New prompt");
    });

    it("does nothing when updates object is empty (no image_asset_key=null)", async () => {
        await repo.updateQuestion("q-uuid-1", {});
        // Should not send any command — early return
        expect(mockSend).not.toHaveBeenCalled();
    });

    it("builds SET expression for reward config fields", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateQuestion("q-uuid-1", { base_xp: 10, min_xp: 2 });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("#base_xp = :base_xp");
        expect(cmd.input.ExpressionAttributeValues[":base_xp"]).toBe(10);
        expect(cmd.input.ExpressionAttributeValues[":min_xp"]).toBe(2);
    });

    it("builds order_key and order_index SET together", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateQuestion("q-uuid-1", { order_index: 3, order_key: "0003" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("#order_index = :order_index");
        expect(cmd.input.UpdateExpression).toContain("#order_key = :order_key");
    });

    it("uses REMOVE expression when image_asset_key is null", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateQuestion("q-uuid-1", { image_asset_key: null });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("REMOVE #image_asset_key");
    });

    it("combines SET and REMOVE when image_asset_key=null with other fields", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateQuestion("q-uuid-1", { prompt: "New", image_asset_key: null });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("SET");
        expect(cmd.input.UpdateExpression).toContain("REMOVE #image_asset_key");
    });

    it("sets image_asset_key normally when it is a string", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateQuestion("q-uuid-1", { image_asset_key: "images/q1.png" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("#image_asset_key = :image_asset_key");
        expect(cmd.input.ExpressionAttributeValues[":image_asset_key"]).toBe("images/q1.png");
    });
});

// ---------------------------------------------------------------------------
// deleteQuestion
// ---------------------------------------------------------------------------
describe("deleteQuestion", () => {
    it("sends DeleteCommand with question_id key", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.deleteQuestion("q-uuid-1");

        expect(mockSend).toHaveBeenCalledTimes(1);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toEqual({ question_id: "q-uuid-1" });
        expect(cmd.input.TableName).toBe("test-questions-table");
    });
});

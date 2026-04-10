/**
 * Unit tests for questQuestionResponses/repo.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questQuestionResponses
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock AWS SDK (must be before dynamic import)
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
}));

// ---------------------------------------------------------------------------
// Repo reference (dynamic import after env is set)
// ---------------------------------------------------------------------------
let repo: typeof import("../repo.js");

beforeAll(async () => {
    process.env.QUEST_QUESTION_RESPONSES_TABLE_NAME = "test-qqr-table";
    repo = await import("../repo.js");
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeItem(overrides: Record<string, any> = {}) {
    return {
        instance_student_pk: "qi-1#s-1",
        question_id: "q-1",
        response_id: "resp-1",
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
        status: "SUBMITTED" as any,
        xp_awarded_total: 0,
        gold_awarded_total: 0,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// upsertResponse
// ---------------------------------------------------------------------------
describe("upsertResponse", () => {
    it("calls PutCommand with the item", async () => {
        mockSend.mockResolvedValueOnce({});
        const item = makeItem();
        await repo.upsertResponse(item);

        expect(mockSend).toHaveBeenCalledTimes(1);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-qqr-table");
        expect(cmd.input.Item).toMatchObject({ quest_instance_id: "qi-1", student_id: "s-1" });
    });
});

// ---------------------------------------------------------------------------
// getResponse
// ---------------------------------------------------------------------------
describe("getResponse", () => {
    it("calls GetCommand with composite PK", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeItem() });
        const result = await repo.getResponse("qi-1", "s-1", "q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toEqual({ instance_student_pk: "qi-1#s-1", question_id: "q-1" });
        expect(result).not.toBeNull();
    });

    it("returns null when item not found", async () => {
        mockSend.mockResolvedValueOnce({});
        const result = await repo.getResponse("qi-99", "s-99", "q-99");
        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// listByInstance
// ---------------------------------------------------------------------------
describe("listByInstance", () => {
    it("queries gsi1 with quest_instance_id condition", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        await repo.listByInstance("qi-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.KeyConditionExpression).toContain("quest_instance_id");
        expect(cmd.input.ExpressionAttributeValues[":qid"]).toBe("qi-1");
    });

    it("passes limit to QueryCommand", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        await repo.listByInstance("qi-1", 10);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(10);
    });

    it("encodes LastEvaluatedKey as base64 cursor", async () => {
        const lek = { instance_student_pk: "qi-1#s-1", question_id: "q-1" };
        mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: lek });
        const result = await repo.listByInstance("qi-1");

        expect(result.cursor).toBe(Buffer.from(JSON.stringify(lek)).toString("base64"));
    });

    it("passes cursor as ExclusiveStartKey", async () => {
        const lek = { instance_student_pk: "qi-1#s-1", question_id: "q-1" };
        const cursor = Buffer.from(JSON.stringify(lek)).toString("base64");
        mockSend.mockResolvedValueOnce({ Items: [] });
        await repo.listByInstance("qi-1", undefined, cursor);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lek);
    });
});

// ---------------------------------------------------------------------------
// listByStudent
// ---------------------------------------------------------------------------
describe("listByStudent", () => {
    it("queries gsi2 with student_id condition", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        await repo.listByStudent("s-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi2");
        expect(cmd.input.ExpressionAttributeValues[":sid"]).toBe("s-1");
    });

    it("returns cursor when LastEvaluatedKey present", async () => {
        const lek = { student_id: "s-1" };
        mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: lek });
        const result = await repo.listByStudent("s-1");
        expect(result.cursor).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// listByQuestion
// ---------------------------------------------------------------------------
describe("listByQuestion", () => {
    it("queries gsi3 with question_id condition", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        await repo.listByQuestion("q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi3");
        expect(cmd.input.ExpressionAttributeValues[":qid"]).toBe("q-1");
    });
});

// ---------------------------------------------------------------------------
// listByInstanceAndStudent
// ---------------------------------------------------------------------------
describe("listByInstanceAndStudent", () => {
    it("queries main table with instance_student_pk", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        await repo.listByInstanceAndStudent("qi-1", "s-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBeUndefined();
        expect(cmd.input.KeyConditionExpression).toContain("instance_student_pk");
        expect(cmd.input.ExpressionAttributeValues[":pk"]).toBe("qi-1#s-1");
    });

    it("returns items and cursor", async () => {
        const lek = { instance_student_pk: "qi-1#s-1" };
        mockSend.mockResolvedValueOnce({ Items: [makeItem()], LastEvaluatedKey: lek });
        const result = await repo.listByInstanceAndStudent("qi-1", "s-1");

        expect(result.items).toHaveLength(1);
        expect(result.cursor).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// gradeResponse
// ---------------------------------------------------------------------------
describe("gradeResponse", () => {
    it("sends UpdateCommand with attribute_exists ConditionExpression", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.gradeResponse("qi-1", "s-1", "q-1", {
            teacher_points_awarded: 10,
            status: "GRADED" as any,
        });

        expect(mockSend).toHaveBeenCalledTimes(1);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ConditionExpression).toContain("attribute_exists(instance_student_pk)");
    });

    it("uses correct Key (instance_student_pk + question_id)", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.gradeResponse("qi-1", "s-1", "q-1", {});

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toEqual({ instance_student_pk: "qi-1#s-1", question_id: "q-1" });
    });

    it("always sets graded_at", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.gradeResponse("qi-1", "s-1", "q-1", {});

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("graded_at = :graded_at");
        expect(cmd.input.ExpressionAttributeValues[":graded_at"]).toBeDefined();
    });

    it("uses #status alias when status is in patch", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.gradeResponse("qi-1", "s-1", "q-1", { status: "GRADED" as any });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeNames?.["#status"]).toBe("status");
        expect(cmd.input.UpdateExpression).toContain("#status = :status");
    });

    it("does NOT set ExpressionAttributeNames when status is omitted", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.gradeResponse("qi-1", "s-1", "q-1", { teacher_points_awarded: 5 });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeNames).toBeUndefined();
    });

    it("includes all optional fields when provided", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.gradeResponse("qi-1", "s-1", "q-1", {
            teacher_points_awarded: 8,
            teacher_comment: "Great work",
            graded_by_teacher_id: "t-1",
            status: "GRADED" as any,
            xp_awarded_total: 50,
            gold_awarded_total: 10,
            reward_status: "PENDING" as any,
        });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":points"]).toBe(8);
        expect(cmd.input.ExpressionAttributeValues[":comment"]).toBe("Great work");
        expect(cmd.input.ExpressionAttributeValues[":teacher_id"]).toBe("t-1");
        expect(cmd.input.ExpressionAttributeValues[":xp"]).toBe(50);
        expect(cmd.input.ExpressionAttributeValues[":gold"]).toBe(10);
        expect(cmd.input.ExpressionAttributeValues[":reward_status"]).toBe("PENDING");
    });
});

// ---------------------------------------------------------------------------
// markRewardApplied
// ---------------------------------------------------------------------------
describe("markRewardApplied", () => {
    it("sends UpdateCommand with APPLIED status", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.markRewardApplied("qi-1", "s-1", "q-1", "txn-abc", 50, 10);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":status"]).toBe("APPLIED");
        expect(cmd.input.ExpressionAttributeValues[":txn_id"]).toBe("txn-abc");
        expect(cmd.input.ExpressionAttributeValues[":xp"]).toBe(50);
        expect(cmd.input.ExpressionAttributeValues[":gold"]).toBe(10);
    });

    it("ConditionExpression guards attribute_exists AND not-already-applied", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.markRewardApplied("qi-1", "s-1", "q-1", "txn-abc", 50, 10);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ConditionExpression).toContain("attribute_exists(instance_student_pk)");
        expect(cmd.input.ConditionExpression).toContain("attribute_not_exists(reward_txn_id)");
        expect(cmd.input.ConditionExpression).toContain("reward_txn_id <> :txn_id");
    });

    it("uses correct Key", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.markRewardApplied("qi-1", "s-1", "q-1", "txn-abc", 0, 0);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toEqual({ instance_student_pk: "qi-1#s-1", question_id: "q-1" });
    });
});

// ---------------------------------------------------------------------------
// markRewardReversed
// ---------------------------------------------------------------------------
describe("markRewardReversed", () => {
    it("sends UpdateCommand with REVERSED status", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.markRewardReversed("qi-1", "s-1", "q-1", "txn-abc");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":status"]).toBe("REVERSED");
        expect(cmd.input.ExpressionAttributeValues[":txn_id"]).toBe("txn-abc");
    });

    it("ConditionExpression requires attribute_exists AND txn_id match", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.markRewardReversed("qi-1", "s-1", "q-1", "txn-abc");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ConditionExpression).toContain("attribute_exists(instance_student_pk)");
        expect(cmd.input.ConditionExpression).toContain("reward_txn_id = :txn_id");
    });

    it("uses correct Key", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.markRewardReversed("qi-1", "s-1", "q-1", "txn-abc");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toEqual({ instance_student_pk: "qi-1#s-1", question_id: "q-1" });
    });
});

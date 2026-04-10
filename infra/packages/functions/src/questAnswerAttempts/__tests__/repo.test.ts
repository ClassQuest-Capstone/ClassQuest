/**
 * Unit tests for questAnswerAttempts/repo.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questAnswerAttempts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock AWS SDK
// ---------------------------------------------------------------------------
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: vi.fn(function () { return {}; }),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(function () { return { send: mockSend }; }),
    },
    PutCommand:          vi.fn(function (input: any) { return { input }; }),
    UpdateCommand:       vi.fn(function (input: any) { return { input }; }),
    QueryCommand:        vi.fn(function (input: any) { return { input }; }),
    TransactWriteCommand: vi.fn(function (input: any) { return { input }; }),
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
let repo: typeof import("../repo.js");

beforeAll(async () => {
    process.env.QUEST_ANSWER_ATTEMPTS_TABLE_NAME = "test-quest-answer-attempts";
    repo = await import("../repo.js");
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function encodeCursor(key: Record<string, any>) {
    return Buffer.from(JSON.stringify(key)).toString("base64");
}

function makeAttemptItem(overrides: Record<string, any> = {}) {
    return {
        quest_attempt_pk: "QI#qi-1#S#s-1#Q#q-1",
        attempt_sk: "A#000001#T#2024-01-01T00:00:00.000Z",
        quest_instance_id: "qi-1",
        student_id: "s-1",
        question_id: "q-1",
        attempt_no: 1,
        answer_raw: "my answer",
        created_at: "2024-01-01T00:00:00.000Z",
        gsi1_pk: "S#s-1#QI#qi-1",
        gsi1_sk: "T#2024-01-01T00:00:00.000Z#Q#q-1#A#000001",
        gsi2_pk: "QI#qi-1#Q#q-1",
        gsi2_sk: "T#2024-01-01T00:00:00.000Z#S#s-1#A#000001",
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// allocateAttemptNo
// ---------------------------------------------------------------------------
describe("allocateAttemptNo", () => {
    it("sends UpdateCommand with ADD expression", async () => {
        mockSend.mockResolvedValueOnce({ Attributes: { next_attempt_no: 1 } });

        await repo.allocateAttemptNo("qi-1", "s-1", "q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("ADD next_attempt_no");
        expect(cmd.input.ExpressionAttributeValues[":inc"]).toBe(1);
    });

    it("uses ReturnValues: UPDATED_NEW", async () => {
        mockSend.mockResolvedValueOnce({ Attributes: { next_attempt_no: 2 } });

        await repo.allocateAttemptNo("qi-1", "s-1", "q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ReturnValues).toBe("UPDATED_NEW");
    });

    it("returns the allocated attempt number", async () => {
        mockSend.mockResolvedValueOnce({ Attributes: { next_attempt_no: 3 } });

        const result = await repo.allocateAttemptNo("qi-1", "s-1", "q-1");

        expect(result).toBe(3);
    });

    it("throws when Attributes is missing", async () => {
        mockSend.mockResolvedValueOnce({});

        await expect(repo.allocateAttemptNo("qi-1", "s-1", "q-1")).rejects.toThrow("Failed to allocate attempt_no");
    });

    it("uses the counter item key with fixed SK COUNTER", async () => {
        mockSend.mockResolvedValueOnce({ Attributes: { next_attempt_no: 1 } });

        await repo.allocateAttemptNo("qi-1", "s-1", "q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key.attempt_sk).toBe("COUNTER");
        expect(cmd.input.Key.quest_attempt_pk).toContain("COUNTER#QI#qi-1");
    });
});

// ---------------------------------------------------------------------------
// putAttempt
// ---------------------------------------------------------------------------
describe("putAttempt", () => {
    it("sends PutCommand with correct TableName", async () => {
        mockSend.mockResolvedValueOnce({});
        const item = makeAttemptItem();

        await repo.putAttempt(item as any);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-quest-answer-attempts");
        expect(cmd.input.Item).toEqual(item);
    });
});

// ---------------------------------------------------------------------------
// createAttemptWithCounter
// ---------------------------------------------------------------------------
describe("createAttemptWithCounter", () => {
    it("makes two DDB calls: UpdateCommand (counter) then PutCommand", async () => {
        mockSend
            .mockResolvedValueOnce({ Attributes: { next_attempt_no: 1 } })  // allocate
            .mockResolvedValueOnce({});                                       // put

        await repo.createAttemptWithCounter("qi-1", "s-1", "q-1", "my answer", undefined, "2024-01-01T00:00:00.000Z");

        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("returns item with correct quest_instance_id, student_id, question_id", async () => {
        mockSend
            .mockResolvedValueOnce({ Attributes: { next_attempt_no: 1 } })
            .mockResolvedValueOnce({});

        const result = await repo.createAttemptWithCounter("qi-1", "s-1", "q-1", "answer", undefined, "2024-01-01T00:00:00.000Z");

        expect(result.quest_instance_id).toBe("qi-1");
        expect(result.student_id).toBe("s-1");
        expect(result.question_id).toBe("q-1");
    });

    it("returns item with attempt_no from counter", async () => {
        mockSend
            .mockResolvedValueOnce({ Attributes: { next_attempt_no: 5 } })
            .mockResolvedValueOnce({});

        const result = await repo.createAttemptWithCounter("qi-1", "s-1", "q-1", "answer", undefined, "2024-01-01T00:00:00.000Z");

        expect(result.attempt_no).toBe(5);
    });

    it("includes gsi1_pk and gsi2_pk in returned item", async () => {
        mockSend
            .mockResolvedValueOnce({ Attributes: { next_attempt_no: 1 } })
            .mockResolvedValueOnce({});

        const result = await repo.createAttemptWithCounter("qi-1", "s-1", "q-1", "answer", undefined, "2024-01-01T00:00:00.000Z");

        expect(result.gsi1_pk).toBe("S#s-1#QI#qi-1");
        expect(result.gsi2_pk).toBe("QI#qi-1#Q#q-1");
    });

    it("includes answer_normalized when provided", async () => {
        mockSend
            .mockResolvedValueOnce({ Attributes: { next_attempt_no: 1 } })
            .mockResolvedValueOnce({});

        const result = await repo.createAttemptWithCounter("qi-1", "s-1", "q-1", "answer", "normalized", "2024-01-01T00:00:00.000Z");

        expect(result.answer_normalized).toBe("normalized");
    });
});

// ---------------------------------------------------------------------------
// queryByPK
// ---------------------------------------------------------------------------
describe("queryByPK", () => {
    it("returns items from query result", async () => {
        const items = [makeAttemptItem()];
        mockSend.mockResolvedValueOnce({ Items: items });

        const result = await repo.queryByPK("qi-1", "s-1", "q-1");

        expect(result.items).toEqual(items);
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValueOnce({});

        const result = await repo.queryByPK("qi-1", "s-1", "q-1");

        expect(result.items).toEqual([]);
    });

    it("passes ScanIndexForward: false (most recent first)", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.queryByPK("qi-1", "s-1", "q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ScanIndexForward).toBe(false);
    });

    it("uses begins_with sk_prefix A# to filter counter items", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.queryByPK("qi-1", "s-1", "q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":sk_prefix"]).toBe("A#");
    });

    it("passes Limit when provided", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.queryByPK("qi-1", "s-1", "q-1", 10);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(10);
    });

    it("encodes LastEvaluatedKey as base64 cursor", async () => {
        const lek = { quest_attempt_pk: "pk", attempt_sk: "sk" };
        mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: lek });

        const result = await repo.queryByPK("qi-1", "s-1", "q-1");

        expect(result.cursor).toBe(encodeCursor(lek));
    });

    it("returns undefined cursor when no LastEvaluatedKey", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        const result = await repo.queryByPK("qi-1", "s-1", "q-1");

        expect(result.cursor).toBeUndefined();
    });

    it("passes decoded cursor as ExclusiveStartKey", async () => {
        const lek = { quest_attempt_pk: "pk", attempt_sk: "sk" };
        const cursor = encodeCursor(lek);
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.queryByPK("qi-1", "s-1", "q-1", undefined, cursor);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lek);
    });
});

// ---------------------------------------------------------------------------
// queryByGSI1
// ---------------------------------------------------------------------------
describe("queryByGSI1", () => {
    it("queries gsi1 index", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.queryByGSI1("qi-1", "s-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi1");
    });

    it("uses gsi1_pk format S#<student>#QI#<instance>", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.queryByGSI1("qi-1", "s-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":pk"]).toBe("S#s-1#QI#qi-1");
    });

    it("returns items", async () => {
        const items = [makeAttemptItem()];
        mockSend.mockResolvedValueOnce({ Items: items });

        const result = await repo.queryByGSI1("qi-1", "s-1");

        expect(result.items).toEqual(items);
    });

    it("returns empty items when Items is undefined", async () => {
        mockSend.mockResolvedValueOnce({});

        const result = await repo.queryByGSI1("qi-1", "s-1");

        expect(result.items).toEqual([]);
    });

    it("passes ScanIndexForward: false", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.queryByGSI1("qi-1", "s-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ScanIndexForward).toBe(false);
    });

    it("encodes LastEvaluatedKey as cursor", async () => {
        const lek = { gsi1_pk: "pk", gsi1_sk: "sk" };
        mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: lek });

        const result = await repo.queryByGSI1("qi-1", "s-1");

        expect(result.cursor).toBe(encodeCursor(lek));
    });

    it("passes decoded cursor as ExclusiveStartKey", async () => {
        const lek = { gsi1_pk: "pk" };
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.queryByGSI1("qi-1", "s-1", undefined, encodeCursor(lek));

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lek);
    });
});

// ---------------------------------------------------------------------------
// queryByGSI2
// ---------------------------------------------------------------------------
describe("queryByGSI2", () => {
    it("queries gsi2 index", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.queryByGSI2("qi-1", "q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi2");
    });

    it("uses gsi2_pk format QI#<instance>#Q#<question>", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.queryByGSI2("qi-1", "q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":pk"]).toBe("QI#qi-1#Q#q-1");
    });

    it("returns items", async () => {
        const items = [makeAttemptItem()];
        mockSend.mockResolvedValueOnce({ Items: items });

        const result = await repo.queryByGSI2("qi-1", "q-1");

        expect(result.items).toEqual(items);
    });

    it("returns empty items when Items is undefined", async () => {
        mockSend.mockResolvedValueOnce({});

        const result = await repo.queryByGSI2("qi-1", "q-1");

        expect(result.items).toEqual([]);
    });

    it("passes ScanIndexForward: false", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.queryByGSI2("qi-1", "q-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ScanIndexForward).toBe(false);
    });

    it("encodes LastEvaluatedKey as cursor", async () => {
        const lek = { gsi2_pk: "pk", gsi2_sk: "sk" };
        mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: lek });

        const result = await repo.queryByGSI2("qi-1", "q-1");

        expect(result.cursor).toBe(encodeCursor(lek));
    });
});

// ---------------------------------------------------------------------------
// updateAttemptGrade
// ---------------------------------------------------------------------------
describe("updateAttemptGrade", () => {
    function makeGradeData(overrides: Record<string, any> = {}) {
        return {
            graded_at: "2024-01-01T12:00:00.000Z",
            is_correct: true,
            grader_type: "AUTO",
            ...overrides,
        };
    }

    it("throws when attempt_no not found", async () => {
        // queryByPK returns items but none match attempt_no 99
        mockSend.mockResolvedValueOnce({ Items: [makeAttemptItem({ attempt_no: 1 })] });

        await expect(
            repo.updateAttemptGrade("qi-1", "s-1", "q-1", 99, makeGradeData())
        ).rejects.toThrow("not found");
    });

    it("throws when no grading fields provided (graded_at falsy, no other fields)", async () => {
        const item = makeAttemptItem({ attempt_no: 1 });
        mockSend.mockResolvedValueOnce({ Items: [item] });

        // graded_at must be falsy AND all optional fields absent to trigger "no fields" error
        await expect(
            repo.updateAttemptGrade("qi-1", "s-1", "q-1", 1, { graded_at: "" })
        ).rejects.toThrow("No grading fields to update");
    });

    it("makes QueryCommand then UpdateCommand (2 DDB calls) on success", async () => {
        const item = makeAttemptItem({ attempt_no: 1 });
        mockSend
            .mockResolvedValueOnce({ Items: [item] })  // queryByPK
            .mockResolvedValueOnce({});                  // UpdateCommand

        await repo.updateAttemptGrade("qi-1", "s-1", "q-1", 1, makeGradeData());

        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("includes is_correct in UpdateExpression when provided", async () => {
        const item = makeAttemptItem({ attempt_no: 1 });
        mockSend
            .mockResolvedValueOnce({ Items: [item] })
            .mockResolvedValueOnce({});

        await repo.updateAttemptGrade("qi-1", "s-1", "q-1", 1, makeGradeData({ is_correct: false }));

        const updateCmd = mockSend.mock.calls[1][0];
        expect(updateCmd.input.ExpressionAttributeValues[":is_correct"]).toBe(false);
    });

    it("uses the attempt_sk from queried item as Key", async () => {
        const item = makeAttemptItem({ attempt_no: 1, attempt_sk: "A#000001#T#2024-01-01T00:00:00.000Z" });
        mockSend
            .mockResolvedValueOnce({ Items: [item] })
            .mockResolvedValueOnce({});

        await repo.updateAttemptGrade("qi-1", "s-1", "q-1", 1, makeGradeData());

        const updateCmd = mockSend.mock.calls[1][0];
        expect(updateCmd.input.Key.attempt_sk).toBe("A#000001#T#2024-01-01T00:00:00.000Z");
    });

    it("includes xp_awarded and gold_awarded when provided", async () => {
        const item = makeAttemptItem({ attempt_no: 1 });
        mockSend
            .mockResolvedValueOnce({ Items: [item] })
            .mockResolvedValueOnce({});

        await repo.updateAttemptGrade("qi-1", "s-1", "q-1", 1, {
            ...makeGradeData(),
            xp_awarded: 100,
            gold_awarded: 50,
        });

        const updateCmd = mockSend.mock.calls[1][0];
        expect(updateCmd.input.ExpressionAttributeValues[":xp_awarded"]).toBe(100);
        expect(updateCmd.input.ExpressionAttributeValues[":gold_awarded"]).toBe(50);
    });
});

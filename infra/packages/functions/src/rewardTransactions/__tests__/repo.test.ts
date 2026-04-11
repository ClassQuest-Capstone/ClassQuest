import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  DynamoDB mock boilerplate                                         */
/* ------------------------------------------------------------------ */
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: vi.fn(function () { return {}; }),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(function () { return { send: mockSend }; }),
    },
    PutCommand:   vi.fn(function (input: any) { return { input }; }),
    GetCommand:   vi.fn(function (input: any) { return { input }; }),
    QueryCommand: vi.fn(function (input: any) { return { input }; }),
}));

/* ------------------------------------------------------------------ */
/*  Module under test                                                  */
/* ------------------------------------------------------------------ */
let repo: typeof import("../repo.ts");

beforeAll(async () => {
    process.env.REWARD_TRANSACTIONS_TABLE_NAME = "test-transactions";
    repo = await import("../repo.ts");
});

beforeEach(() => {
    mockSend.mockReset();
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function makeTxn(overrides: Record<string, any> = {}) {
    return {
        transaction_id: "tx-1",
        student_id: "stu-1",
        class_id: "class-1",
        xp_delta: 10,
        gold_delta: 5,
        hearts_delta: 0,
        source_type: "MANUAL_ADJUSTMENT",
        created_at: "2026-01-01T00:00:00.000Z",
        created_by: "teacher-1",
        created_by_role: "TEACHER",
        gsi1_pk: "S#stu-1",
        gsi1_sk: "T#2026-01-01T00:00:00.000Z#TX#tx-1",
        ...overrides,
    };
}

/* ================================================================== */
/*  putTransaction                                                     */
/* ================================================================== */
describe("putTransaction", () => {
    it("sends PutCommand with correct table and condition", async () => {
        mockSend.mockResolvedValue({});
        const item = makeTxn();

        await repo.putTransaction(item as any);

        expect(mockSend).toHaveBeenCalledOnce();
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-transactions");
        expect(cmd.input.Item).toEqual(item);
        expect(cmd.input.ConditionExpression).toBe("attribute_not_exists(transaction_id)");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(repo.putTransaction(makeTxn() as any)).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.putTransaction(makeTxn() as any)).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  getTransaction                                                     */
/* ================================================================== */
describe("getTransaction", () => {
    it("returns item when found", async () => {
        const item = makeTxn();
        mockSend.mockResolvedValue({ Item: item });

        const result = await repo.getTransaction("tx-1");

        expect(result).toEqual(item);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-transactions");
        expect(cmd.input.Key).toEqual({ transaction_id: "tx-1" });
    });

    it("returns null when not found", async () => {
        mockSend.mockResolvedValue({});
        const result = await repo.getTransaction("missing");
        expect(result).toBeNull();
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.getTransaction("tx-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listByStudent                                                      */
/* ================================================================== */
describe("listByStudent", () => {
    it("queries gsi1 with correct pk", async () => {
        const items = [makeTxn()];
        mockSend.mockResolvedValue({ Items: items });

        const result = await repo.listByStudent("stu-1");

        expect(result.items).toEqual(items);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.ExpressionAttributeValues[":pk"]).toBe("S#stu-1");
        expect(cmd.input.ScanIndexForward).toBe(false);
    });

    it("returns empty items when no results", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        const result = await repo.listByStudent("stu-1");
        expect(result.items).toEqual([]);
        expect(result.cursor).toBeUndefined();
    });

    it("passes limit to DynamoDB", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        await repo.listByStudent("stu-1", 25);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(25);
    });

    it("decodes cursor to ExclusiveStartKey", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        const lek = { transaction_id: "tx-1", gsi1_pk: "S#stu-1", gsi1_sk: "T#..." };
        const cursor = Buffer.from(JSON.stringify(lek)).toString("base64");

        await repo.listByStudent("stu-1", undefined, cursor);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lek);
    });

    it("encodes LastEvaluatedKey as cursor", async () => {
        const lek = { transaction_id: "tx-1", gsi1_pk: "S#stu-1" };
        mockSend.mockResolvedValue({ Items: [makeTxn()], LastEvaluatedKey: lek });

        const result = await repo.listByStudent("stu-1");

        expect(result.cursor).toBe(Buffer.from(JSON.stringify(lek)).toString("base64"));
    });

    it("returns undefined cursor when no LastEvaluatedKey", async () => {
        mockSend.mockResolvedValue({ Items: [makeTxn()] });
        const result = await repo.listByStudent("stu-1");
        expect(result.cursor).toBeUndefined();
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.listByStudent("stu-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listByStudentAndClass                                              */
/* ================================================================== */
describe("listByStudentAndClass", () => {
    it("queries gsi2 with correct pk", async () => {
        mockSend.mockResolvedValue({ Items: [makeTxn()] });

        const result = await repo.listByStudentAndClass("stu-1", "class-1");

        expect(result.items).toHaveLength(1);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi2");
        expect(cmd.input.ExpressionAttributeValues[":pk"]).toBe("C#class-1#S#stu-1");
        expect(cmd.input.ScanIndexForward).toBe(false);
    });

    it("returns empty when no items", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        const result = await repo.listByStudentAndClass("stu-1", "class-1");
        expect(result.items).toEqual([]);
    });

    it("encodes LastEvaluatedKey as cursor", async () => {
        const lek = { transaction_id: "tx-1" };
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: lek });

        const result = await repo.listByStudentAndClass("stu-1", "class-1");
        expect(result.cursor).toBeDefined();
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.listByStudentAndClass("stu-1", "class-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listBySource                                                       */
/* ================================================================== */
describe("listBySource", () => {
    it("queries gsi3 with correct pk", async () => {
        mockSend.mockResolvedValue({ Items: [makeTxn()] });

        const result = await repo.listBySource("QUEST_QUESTION", "qi-1");

        expect(result.items).toHaveLength(1);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi3");
        expect(cmd.input.ExpressionAttributeValues[":pk"]).toBe("SRC#QUEST_QUESTION#qi-1");
        expect(cmd.input.ScanIndexForward).toBe(false);
    });

    it("returns empty when no items", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        const result = await repo.listBySource("BOSS_BATTLE", "bb-1");
        expect(result.items).toEqual([]);
    });

    it("passes limit and decodes cursor", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        const lek = { transaction_id: "tx-1" };
        const cursor = Buffer.from(JSON.stringify(lek)).toString("base64");

        await repo.listBySource("QUEST_QUESTION", "qi-1", 10, cursor);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(10);
        expect(cmd.input.ExclusiveStartKey).toEqual(lek);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.listBySource("QUEST_QUESTION", "qi-1")).rejects.toThrow("DDB boom");
    });
});

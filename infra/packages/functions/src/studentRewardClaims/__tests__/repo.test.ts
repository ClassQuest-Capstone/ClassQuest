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
    PutCommand:    vi.fn(function (input: any) { return { input }; }),
    GetCommand:    vi.fn(function (input: any) { return { input }; }),
    QueryCommand:  vi.fn(function (input: any) { return { input }; }),
    UpdateCommand: vi.fn(function (input: any) { return { input }; }),
}));

/* ------------------------------------------------------------------ */
/*  Module under test                                                  */
/* ------------------------------------------------------------------ */
let repo: typeof import("../repo.ts");

beforeAll(async () => {
    process.env.STUDENT_REWARD_CLAIMS_TABLE_NAME = "test-claims";
    repo = await import("../repo.ts");
});

beforeEach(() => {
    mockSend.mockReset();
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function makeClaim(overrides: Record<string, any> = {}) {
    return {
        student_reward_claim_id: "claim-1",
        student_id: "stu-1",
        class_id: "class-1",
        reward_id: "reward-1",
        status: "AVAILABLE",
        unlocked_at_level: 5,
        claim_sort: "AVAILABLE#class-1#00005#reward-1",
        unlocked_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

/* ================================================================== */
/*  createStudentRewardClaim                                           */
/* ================================================================== */
describe("createStudentRewardClaim", () => {
    it("sends PutCommand with correct table and condition", async () => {
        mockSend.mockResolvedValue({});
        const item = makeClaim();

        await repo.createStudentRewardClaim(item as any);

        expect(mockSend).toHaveBeenCalledOnce();
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-claims");
        expect(cmd.input.Item).toEqual(item);
        expect(cmd.input.ConditionExpression).toBe("attribute_not_exists(student_reward_claim_id)");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);
        await expect(repo.createStudentRewardClaim(makeClaim() as any)).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.createStudentRewardClaim(makeClaim() as any)).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  getStudentRewardClaimById                                          */
/* ================================================================== */
describe("getStudentRewardClaimById", () => {
    it("returns item when found", async () => {
        const item = makeClaim();
        mockSend.mockResolvedValue({ Item: item });

        const result = await repo.getStudentRewardClaimById("claim-1");
        expect(result).toEqual(item);
        expect(mockSend.mock.calls[0][0].input.Key).toEqual({ student_reward_claim_id: "claim-1" });
    });

    it("returns null when not found", async () => {
        mockSend.mockResolvedValue({});
        expect(await repo.getStudentRewardClaimById("missing")).toBeNull();
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.getStudentRewardClaimById("claim-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listStudentRewardClaimsByStudent                                   */
/* ================================================================== */
describe("listStudentRewardClaimsByStudent", () => {
    it("queries GSI1 with student_id", async () => {
        const items = [makeClaim()];
        mockSend.mockResolvedValue({ Items: items });

        const result = await repo.listStudentRewardClaimsByStudent("stu-1");
        expect(result).toEqual(items);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("GSI1");
        expect(cmd.input.ExpressionAttributeValues[":sid"]).toBe("stu-1");
    });

    it("filters by status when option provided", async () => {
        const available = makeClaim({ status: "AVAILABLE" });
        const claimed = makeClaim({ student_reward_claim_id: "claim-2", status: "CLAIMED" });
        mockSend.mockResolvedValue({ Items: [available, claimed] });

        const result = await repo.listStudentRewardClaimsByStudent("stu-1", { status: "AVAILABLE" });
        expect(result).toHaveLength(1);
        expect(result[0].status).toBe("AVAILABLE");
    });

    it("returns empty array when no items", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        expect(await repo.listStudentRewardClaimsByStudent("stu-1")).toEqual([]);
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValue({});
        expect(await repo.listStudentRewardClaimsByStudent("stu-1")).toEqual([]);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.listStudentRewardClaimsByStudent("stu-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listStudentRewardClaimsByStudentAndClass                           */
/* ================================================================== */
describe("listStudentRewardClaimsByStudentAndClass", () => {
    it("filters results by class_id", async () => {
        const match = makeClaim({ class_id: "class-1" });
        const noMatch = makeClaim({ student_reward_claim_id: "claim-2", class_id: "class-other" });
        mockSend.mockResolvedValue({ Items: [match, noMatch] });

        const result = await repo.listStudentRewardClaimsByStudentAndClass("stu-1", "class-1");
        expect(result).toHaveLength(1);
        expect(result[0].class_id).toBe("class-1");
    });

    it("returns empty when no class matches", async () => {
        mockSend.mockResolvedValue({ Items: [makeClaim({ class_id: "other" })] });
        const result = await repo.listStudentRewardClaimsByStudentAndClass("stu-1", "class-1");
        expect(result).toEqual([]);
    });
});

/* ================================================================== */
/*  getStudentRewardClaimByRewardAndStudent                            */
/* ================================================================== */
describe("getStudentRewardClaimByRewardAndStudent", () => {
    it("queries GSI2 with reward_id and student_id", async () => {
        const item = makeClaim();
        mockSend.mockResolvedValue({ Items: [item] });

        const result = await repo.getStudentRewardClaimByRewardAndStudent("reward-1", "stu-1");
        expect(result).toEqual(item);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("GSI2");
        expect(cmd.input.ExpressionAttributeValues[":rid"]).toBe("reward-1");
        expect(cmd.input.ExpressionAttributeValues[":sid"]).toBe("stu-1");
        expect(cmd.input.Limit).toBe(1);
    });

    it("returns null when not found", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        expect(await repo.getStudentRewardClaimByRewardAndStudent("r-1", "s-1")).toBeNull();
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.getStudentRewardClaimByRewardAndStudent("r-1", "s-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  updateStudentRewardClaimStatus                                     */
/* ================================================================== */
describe("updateStudentRewardClaimStatus", () => {
    it("sends UpdateCommand with correct condition and fields", async () => {
        mockSend.mockResolvedValue({});

        await repo.updateStudentRewardClaimStatus("claim-1", "CLAIMED", "CLAIMED#class-1#00005#r-1", "2026-01-02T00:00:00.000Z");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-claims");
        expect(cmd.input.Key).toEqual({ student_reward_claim_id: "claim-1" });
        expect(cmd.input.ExpressionAttributeValues[":new_status"]).toBe("CLAIMED");
        expect(cmd.input.ExpressionAttributeValues[":new_claim_sort"]).toBe("CLAIMED#class-1#00005#r-1");
        expect(cmd.input.ExpressionAttributeValues[":available"]).toBe("AVAILABLE");
        expect(cmd.input.ExpressionAttributeValues[":claimed_at"]).toBe("2026-01-02T00:00:00.000Z");
        expect(cmd.input.ConditionExpression).toContain("attribute_exists(student_reward_claim_id)");
        expect(cmd.input.ConditionExpression).toContain("#status = :available");
    });

    it("omits claimed_at when not provided", async () => {
        mockSend.mockResolvedValue({});

        await repo.updateStudentRewardClaimStatus("claim-1", "CLAIMED", "CLAIMED#...");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":claimed_at"]).toBeUndefined();
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);
        await expect(
            repo.updateStudentRewardClaimStatus("claim-1", "CLAIMED", "CLAIMED#...")
        ).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(
            repo.updateStudentRewardClaimStatus("claim-1", "CLAIMED", "CLAIMED#...")
        ).rejects.toThrow("DDB boom");
    });
});

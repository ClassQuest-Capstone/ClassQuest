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
    process.env.STUDENT_PROFILES_TABLE_NAME = "test-student-profiles";
    repo = await import("../repo.ts");
});

beforeEach(() => {
    mockSend.mockReset();
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function makeProfile(overrides: Record<string, any> = {}) {
    return {
        student_id: "stu-1",
        school_id: "school-1",
        display_name: "Alice",
        username: "alice_01",
        grade: "6",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

/* ================================================================== */
/*  putStudentProfile                                                  */
/* ================================================================== */
describe("putStudentProfile", () => {
    it("sends PutCommand with correct table and condition", async () => {
        mockSend.mockResolvedValue({});
        const item = makeProfile();

        await repo.putStudentProfile(item);

        expect(mockSend).toHaveBeenCalledOnce();
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-student-profiles");
        expect(cmd.input.Item).toEqual(item);
        expect(cmd.input.ConditionExpression).toBe("attribute_not_exists(student_id)");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);
        await expect(repo.putStudentProfile(makeProfile())).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.putStudentProfile(makeProfile())).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  getStudentProfile                                                  */
/* ================================================================== */
describe("getStudentProfile", () => {
    it("returns item when found", async () => {
        const item = makeProfile();
        mockSend.mockResolvedValue({ Item: item });

        const result = await repo.getStudentProfile("stu-1");
        expect(result).toEqual(item);
        expect(mockSend.mock.calls[0][0].input.Key).toEqual({ student_id: "stu-1" });
    });

    it("returns null when not found", async () => {
        mockSend.mockResolvedValue({});
        expect(await repo.getStudentProfile("missing")).toBeNull();
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.getStudentProfile("stu-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  updateStudentProfile                                               */
/* ================================================================== */
describe("updateStudentProfile", () => {
    it("updates display_name and sets updated_at", async () => {
        const updated = makeProfile({ display_name: "Bob" });
        mockSend.mockResolvedValue({ Attributes: updated });

        const result = await repo.updateStudentProfile("stu-1", { display_name: "Bob" });

        expect(result).toEqual(updated);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":display_name"]).toBe("Bob");
        expect(cmd.input.ExpressionAttributeValues[":updated_at"]).toBeDefined();
        expect(cmd.input.ReturnValues).toBe("ALL_NEW");
    });

    it("lowercases username in the update", async () => {
        mockSend.mockResolvedValue({ Attributes: makeProfile({ username: "alice_new" }) });

        await repo.updateStudentProfile("stu-1", { username: "ALICE_NEW" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":username"]).toBe("alice_new");
    });

    it("adds conditional check when currentUsername is provided", async () => {
        mockSend.mockResolvedValue({ Attributes: makeProfile() });

        await repo.updateStudentProfile("stu-1", { username: "new_name" }, "old_name");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ConditionExpression).toContain("#username = :current_username");
        expect(cmd.input.ExpressionAttributeValues[":current_username"]).toBe("old_name");
    });

    it("returns current profile when no updates provided", async () => {
        const existing = makeProfile();
        mockSend.mockResolvedValue({ Item: existing });

        const result = await repo.updateStudentProfile("stu-1", {});
        expect(result).toEqual(existing);
        // Should have called GetCommand, not UpdateCommand
        expect(mockSend.mock.calls[0][0].input.Key).toEqual({ student_id: "stu-1" });
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(
            repo.updateStudentProfile("stu-1", { display_name: "X" })
        ).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(
            repo.updateStudentProfile("stu-1", { display_name: "X" })
        ).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  getStudentProfileByUsername                                        */
/* ================================================================== */
describe("getStudentProfileByUsername", () => {
    it("queries gsi2 with lowercased username", async () => {
        const item = makeProfile();
        mockSend.mockResolvedValue({ Items: [item] });

        const result = await repo.getStudentProfileByUsername("ALICE_01");

        expect(result).toEqual(item);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi2");
        expect(cmd.input.ExpressionAttributeValues[":username"]).toBe("alice_01");
        expect(cmd.input.Limit).toBe(1);
    });

    it("returns null when not found", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        expect(await repo.getStudentProfileByUsername("nobody")).toBeNull();
    });

    it("returns null when Items is undefined", async () => {
        mockSend.mockResolvedValue({});
        expect(await repo.getStudentProfileByUsername("nobody")).toBeNull();
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.getStudentProfileByUsername("alice")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listStudentsBySchool                                               */
/* ================================================================== */
describe("listStudentsBySchool", () => {
    it("queries gsi1 with school_id", async () => {
        const items = [makeProfile()];
        mockSend.mockResolvedValue({ Items: items });

        const result = await repo.listStudentsBySchool("school-1");

        expect(result).toEqual(items);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.ExpressionAttributeValues[":sid"]).toBe("school-1");
    });

    it("returns empty array when no items", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        expect(await repo.listStudentsBySchool("school-1")).toEqual([]);
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValue({});
        expect(await repo.listStudentsBySchool("school-1")).toEqual([]);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.listStudentsBySchool("school-1")).rejects.toThrow("DDB boom");
    });
});

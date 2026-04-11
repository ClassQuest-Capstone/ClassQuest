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
    process.env.TEACHER_PROFILES_TABLE_NAME = "test-teacher-profiles";
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
        teacher_id: "teacher-1",
        school_id: "school-1",
        display_name: "Ms. Smith",
        email: "smith@example.com",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

/* ================================================================== */
/*  putTeacherProfile                                                  */
/* ================================================================== */
describe("putTeacherProfile", () => {
    it("sends PutCommand with correct table and condition", async () => {
        mockSend.mockResolvedValue({});
        const item = makeProfile();

        await repo.putTeacherProfile(item);

        expect(mockSend).toHaveBeenCalledOnce();
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-teacher-profiles");
        expect(cmd.input.Item).toEqual(item);
        expect(cmd.input.ConditionExpression).toBe("attribute_not_exists(teacher_id)");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);
        await expect(repo.putTeacherProfile(makeProfile())).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.putTeacherProfile(makeProfile())).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  getTeacherProfile                                                  */
/* ================================================================== */
describe("getTeacherProfile", () => {
    it("returns item when found", async () => {
        const item = makeProfile();
        mockSend.mockResolvedValue({ Item: item });

        const result = await repo.getTeacherProfile("teacher-1");
        expect(result).toEqual(item);
        expect(mockSend.mock.calls[0][0].input.Key).toEqual({ teacher_id: "teacher-1" });
    });

    it("returns null when not found", async () => {
        mockSend.mockResolvedValue({});
        expect(await repo.getTeacherProfile("missing")).toBeNull();
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.getTeacherProfile("teacher-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listTeachersBySchool                                               */
/* ================================================================== */
describe("listTeachersBySchool", () => {
    it("queries gsi1 with school_id", async () => {
        const items = [makeProfile()];
        mockSend.mockResolvedValue({ Items: items });

        const result = await repo.listTeachersBySchool("school-1");
        expect(result).toEqual(items);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.ExpressionAttributeValues[":sid"]).toBe("school-1");
    });

    it("returns empty array when no items", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        expect(await repo.listTeachersBySchool("school-1")).toEqual([]);
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValue({});
        expect(await repo.listTeachersBySchool("school-1")).toEqual([]);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.listTeachersBySchool("school-1")).rejects.toThrow("DDB boom");
    });
});

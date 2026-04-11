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
    PutCommand:  vi.fn(function (input: any) { return { input }; }),
    GetCommand:  vi.fn(function (input: any) { return { input }; }),
    ScanCommand: vi.fn(function (input: any) { return { input }; }),
}));

/* ------------------------------------------------------------------ */
/*  Module under test                                                  */
/* ------------------------------------------------------------------ */
let repo: typeof import("../repo.ts");

beforeAll(async () => {
    process.env.SCHOOLS_TABLE_NAME = "test-schools";
    repo = await import("../repo.ts");
});

beforeEach(() => {
    mockSend.mockReset();
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function makeSchool(overrides: Record<string, any> = {}) {
    return {
        school_id: "sch-1",
        name: "Maple Elementary",
        division: "Division A",
        city: "Vancouver",
        province: "BC",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

/* ================================================================== */
/*  putSchool                                                          */
/* ================================================================== */
describe("putSchool", () => {
    it("sends PutCommand with correct table and condition", async () => {
        mockSend.mockResolvedValue({});
        const item = makeSchool();

        await repo.putSchool(item);

        expect(mockSend).toHaveBeenCalledOnce();
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-schools");
        expect(cmd.input.Item).toEqual(item);
        expect(cmd.input.ConditionExpression).toBe("attribute_not_exists(school_id)");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(repo.putSchool(makeSchool())).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.putSchool(makeSchool())).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  getSchool                                                          */
/* ================================================================== */
describe("getSchool", () => {
    it("returns item when found", async () => {
        const item = makeSchool();
        mockSend.mockResolvedValue({ Item: item });

        const result = await repo.getSchool("sch-1");

        expect(result).toEqual(item);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-schools");
        expect(cmd.input.Key).toEqual({ school_id: "sch-1" });
    });

    it("returns null when not found", async () => {
        mockSend.mockResolvedValue({});
        const result = await repo.getSchool("missing");
        expect(result).toBeNull();
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.getSchool("sch-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listSchools                                                        */
/* ================================================================== */
describe("listSchools", () => {
    it("returns items from scan", async () => {
        const items = [makeSchool(), makeSchool({ school_id: "sch-2", name: "Oak High" })];
        mockSend.mockResolvedValue({ Items: items });

        const result = await repo.listSchools();

        expect(result).toEqual(items);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-schools");
    });

    it("returns empty array when no items", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        const result = await repo.listSchools();
        expect(result).toEqual([]);
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValue({});
        const result = await repo.listSchools();
        expect(result).toEqual([]);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.listSchools()).rejects.toThrow("DDB boom");
    });
});

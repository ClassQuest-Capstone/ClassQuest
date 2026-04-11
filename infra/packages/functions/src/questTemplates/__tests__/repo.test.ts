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
    DeleteCommand: vi.fn(function (input: any) { return { input }; }),
}));

/* ------------------------------------------------------------------ */
/*  Module under test (dynamic import after env setup)                */
/* ------------------------------------------------------------------ */
let repo: typeof import("../repo.ts");

beforeAll(async () => {
    process.env.QUEST_TEMPLATES_TABLE_NAME = "test-quest-templates";
    repo = await import("../repo.ts");
});

beforeEach(() => {
    mockSend.mockReset();
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function makeTemplate(overrides: Record<string, any> = {}) {
    return {
        quest_template_id: "qt-1",
        owner_teacher_id: "teacher-1",
        title: "Math Quest",
        description: "A math quest",
        subject: "Mathematics",
        class_id: "class-1",
        estimated_duration_minutes: 30,
        base_xp_reward: 100,
        base_gold_reward: 50,
        is_shared_publicly: true,
        type: "QUEST",
        grade: 6,
        difficulty: "MEDIUM",
        visibility_pk: "PUBLIC",
        public_sort: "Mathematics#6#MEDIUM#2026-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

/* ================================================================== */
/*  createTemplate                                                     */
/* ================================================================== */
describe("createTemplate", () => {
    it("sends PutCommand with correct table and condition", async () => {
        mockSend.mockResolvedValue({});
        const item = makeTemplate();

        await repo.createTemplate(item as any);

        expect(mockSend).toHaveBeenCalledOnce();
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-quest-templates");
        expect(cmd.input.Item).toEqual(item);
        expect(cmd.input.ConditionExpression).toBe(
            "attribute_not_exists(quest_template_id)"
        );
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("ConditionalCheckFailed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(repo.createTemplate(makeTemplate() as any)).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));

        await expect(repo.createTemplate(makeTemplate() as any)).rejects.toThrow(
            "DDB boom"
        );
    });
});

/* ================================================================== */
/*  getTemplate                                                        */
/* ================================================================== */
describe("getTemplate", () => {
    it("returns item when found", async () => {
        const item = makeTemplate();
        mockSend.mockResolvedValue({ Item: item });

        const result = await repo.getTemplate("qt-1");

        expect(result).toEqual(item);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-quest-templates");
        expect(cmd.input.Key).toEqual({ quest_template_id: "qt-1" });
    });

    it("returns null when item not found", async () => {
        mockSend.mockResolvedValue({});

        const result = await repo.getTemplate("missing");
        expect(result).toBeNull();
    });

    it("returns null for soft-deleted item by default", async () => {
        const item = makeTemplate({ is_deleted: true, deleted_at: "2026-01-02T00:00:00.000Z" });
        mockSend.mockResolvedValue({ Item: item });

        const result = await repo.getTemplate("qt-1");
        expect(result).toBeNull();
    });

    it("returns soft-deleted item when includeDeleted is true", async () => {
        const item = makeTemplate({ is_deleted: true });
        mockSend.mockResolvedValue({ Item: item });

        const result = await repo.getTemplate("qt-1", { includeDeleted: true });
        expect(result).toEqual(item);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.getTemplate("qt-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listByOwner                                                        */
/* ================================================================== */
describe("listByOwner", () => {
    it("queries gsi1 with correct owner_teacher_id", async () => {
        const items = [makeTemplate()];
        mockSend.mockResolvedValue({ Items: items });

        const result = await repo.listByOwner("teacher-1");

        expect(result).toEqual(items);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-quest-templates");
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.ExpressionAttributeValues[":tid"]).toBe("teacher-1");
    });

    it("returns empty array when no items", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        const result = await repo.listByOwner("teacher-1");
        expect(result).toEqual([]);
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValue({});

        const result = await repo.listByOwner("teacher-1");
        expect(result).toEqual([]);
    });

    it("filters out soft-deleted items by default", async () => {
        const active = makeTemplate({ quest_template_id: "qt-1" });
        const deleted = makeTemplate({ quest_template_id: "qt-2", is_deleted: true });
        mockSend.mockResolvedValue({ Items: [active, deleted] });

        const result = await repo.listByOwner("teacher-1");
        expect(result).toHaveLength(1);
        expect(result[0].quest_template_id).toBe("qt-1");
    });

    it("includes soft-deleted items when includeDeleted is true", async () => {
        const active = makeTemplate({ quest_template_id: "qt-1" });
        const deleted = makeTemplate({ quest_template_id: "qt-2", is_deleted: true });
        mockSend.mockResolvedValue({ Items: [active, deleted] });

        const result = await repo.listByOwner("teacher-1", { includeDeleted: true });
        expect(result).toHaveLength(2);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.listByOwner("teacher-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listPublic                                                         */
/* ================================================================== */
describe("listPublic", () => {
    it("queries gsi2 with visibility_pk=PUBLIC", async () => {
        const items = [makeTemplate()];
        mockSend.mockResolvedValue({ Items: items });

        const result = await repo.listPublic();

        expect(result).toEqual(items);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-quest-templates");
        expect(cmd.input.IndexName).toBe("gsi2");
        expect(cmd.input.ExpressionAttributeValues[":vpk"]).toBe("PUBLIC");
    });

    it("uses default limit of 100", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repo.listPublic();

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(100);
    });

    it("applies subject filter as begins_with prefix", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repo.listPublic({ subject: "Mathematics" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.KeyConditionExpression).toContain("begins_with(public_sort, :prefix)");
        expect(cmd.input.ExpressionAttributeValues[":prefix"]).toBe("Mathematics#");
    });

    it("applies subject+grade filter", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repo.listPublic({ subject: "Mathematics", grade: 6 });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":prefix"]).toBe("Mathematics#6#");
    });

    it("applies subject+grade+difficulty filter", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repo.listPublic({ subject: "Mathematics", grade: 6, difficulty: "HARD" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":prefix"]).toBe("Mathematics#6#HARD#");
    });

    it("does not add begins_with when no filters provided", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repo.listPublic();

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.KeyConditionExpression).toBe("visibility_pk = :vpk");
    });

    it("uses custom limit", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repo.listPublic({ limit: 25 });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(25);
    });

    it("filters out soft-deleted items", async () => {
        const active = makeTemplate({ quest_template_id: "qt-1" });
        const deleted = makeTemplate({ quest_template_id: "qt-2", is_deleted: true });
        mockSend.mockResolvedValue({ Items: [active, deleted] });

        const result = await repo.listPublic();
        expect(result).toHaveLength(1);
        expect(result[0].quest_template_id).toBe("qt-1");
    });

    it("returns empty array when no items", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        const result = await repo.listPublic();
        expect(result).toEqual([]);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.listPublic()).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  updateTemplate                                                     */
/* ================================================================== */
describe("updateTemplate", () => {
    it("sends UpdateCommand with correct table and key", async () => {
        mockSend.mockResolvedValue({});

        await repo.updateTemplate("qt-1", { title: "New Title" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-quest-templates");
        expect(cmd.input.Key).toEqual({ quest_template_id: "qt-1" });
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(quest_template_id)");
    });

    it("always includes updated_at in update expression", async () => {
        mockSend.mockResolvedValue({});

        await repo.updateTemplate("qt-1", { title: "New Title" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("#updated_at = :updated_at");
        expect(cmd.input.ExpressionAttributeNames["#updated_at"]).toBe("updated_at");
        expect(cmd.input.ExpressionAttributeValues[":updated_at"]).toBeDefined();
    });

    it("includes each provided field in update expression", async () => {
        mockSend.mockResolvedValue({});

        await repo.updateTemplate("qt-1", {
            title: "New Title",
            description: "New Desc",
            subject: "Science",
            estimated_duration_minutes: 45,
            base_xp_reward: 200,
            base_gold_reward: 100,
            is_shared_publicly: true,
            type: "DAILY_QUEST",
            grade: 7,
            difficulty: "HARD",
            visibility_pk: "PUBLIC",
            public_sort: "Science#7#HARD#2026-01-01",
        });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":title"]).toBe("New Title");
        expect(cmd.input.ExpressionAttributeValues[":description"]).toBe("New Desc");
        expect(cmd.input.ExpressionAttributeValues[":subject"]).toBe("Science");
        expect(cmd.input.ExpressionAttributeValues[":duration"]).toBe(45);
        expect(cmd.input.ExpressionAttributeValues[":xp"]).toBe(200);
        expect(cmd.input.ExpressionAttributeValues[":gold"]).toBe(100);
        expect(cmd.input.ExpressionAttributeValues[":is_shared"]).toBe(true);
        expect(cmd.input.ExpressionAttributeValues[":type"]).toBe("DAILY_QUEST");
        expect(cmd.input.ExpressionAttributeValues[":grade"]).toBe(7);
        expect(cmd.input.ExpressionAttributeValues[":difficulty"]).toBe("HARD");
        expect(cmd.input.ExpressionAttributeValues[":visibility_pk"]).toBe("PUBLIC");
        expect(cmd.input.ExpressionAttributeValues[":public_sort"]).toBe("Science#7#HARD#2026-01-01");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("ConditionalCheckFailed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(repo.updateTemplate("qt-1", { title: "X" })).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.updateTemplate("qt-1", { title: "X" })).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  softDeleteTemplate                                                 */
/* ================================================================== */
describe("softDeleteTemplate", () => {
    it("sends UpdateCommand with soft delete fields", async () => {
        const returned = makeTemplate({ is_deleted: true });
        mockSend.mockResolvedValue({ Attributes: returned });

        const result = await repo.softDeleteTemplate("qt-1", "teacher-1");

        expect(result).toEqual(returned);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-quest-templates");
        expect(cmd.input.Key).toEqual({ quest_template_id: "qt-1" });
        expect(cmd.input.ExpressionAttributeValues[":is_deleted"]).toBe(true);
        expect(cmd.input.ExpressionAttributeValues[":deleted_by"]).toBe("teacher-1");
        expect(cmd.input.ExpressionAttributeValues[":deleted_at"]).toBeDefined();
        expect(cmd.input.ReturnValues).toBe("ALL_NEW");
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(quest_template_id)");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("ConditionalCheckFailed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(repo.softDeleteTemplate("qt-1", "teacher-1")).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.softDeleteTemplate("qt-1", "teacher-1")).rejects.toThrow("DDB boom");
    });
});

/**
 * Unit tests for bossBattleTemplates/repo.ts
 *
 * Covers functions NOT already tested in soft-delete.test.ts:
 *   - createTemplate
 *   - listPublic
 *   - updateTemplate
 *
 * Also adds DDB command-input assertions for getTemplate and listByOwner
 * that complement (but do not duplicate) the filtering tests in soft-delete.test.ts.
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/bossBattleTemplates
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DynamoDB — hoisted before any module imports
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
// Module reference — env var must be set before dynamic import
// ---------------------------------------------------------------------------
let repoModule: typeof import("../repo.ts");

beforeAll(async () => {
    process.env.BOSS_BATTLE_TEMPLATES_TABLE_NAME = "test-boss-battle-templates";
    repoModule = await import("../repo.ts");
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTemplateRaw(overrides: Record<string, any> = {}) {
    return {
        boss_template_id:    "tpl-1",
        owner_teacher_id:    "teacher-1",
        title:               "Dragon Boss",
        description:         "Fight the dragon",
        subject:             "MATH",
        max_hp:              1000,
        base_xp_reward:      200,
        base_gold_reward:    100,
        is_shared_publicly:  "false",
        public_sort:         "MATH#2024-01-01T00:00:00.000Z#tpl-1",
        created_at:          "2024-01-01T00:00:00.000Z",
        updated_at:          "2024-01-01T00:00:00.000Z",
        is_deleted:          false,
        ...overrides,
    };
}

function makeTemplateItem(overrides: Record<string, any> = {}) {
    return {
        boss_template_id:    "tpl-1",
        owner_teacher_id:    "teacher-1",
        title:               "Dragon Boss",
        description:         "Fight the dragon",
        subject:             "MATH",
        max_hp:              1000,
        base_xp_reward:      200,
        base_gold_reward:    100,
        is_shared_publicly:  false,
        public_sort:         "MATH#2024-01-01T00:00:00.000Z#tpl-1",
        created_at:          "2024-01-01T00:00:00.000Z",
        updated_at:          "2024-01-01T00:00:00.000Z",
        is_deleted:          false,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// getTemplate — DDB command inputs (complementing soft-delete.test.ts filtering tests)
// ---------------------------------------------------------------------------
describe("getTemplate — DDB command inputs", () => {
    it("sends GetCommand with correct TableName and Key", async () => {
        mockSend.mockResolvedValue({ Item: makeTemplateRaw() });

        await repoModule.getTemplate("tpl-1");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.TableName).toBe("test-boss-battle-templates");
        expect(cmd.input.Key).toEqual({ boss_template_id: "tpl-1" });
    });

    it("converts is_shared_publicly string 'true' to boolean true", async () => {
        mockSend.mockResolvedValue({ Item: makeTemplateRaw({ is_shared_publicly: "true" }) });

        const result = await repoModule.getTemplate("tpl-1");

        expect(result!.is_shared_publicly).toBe(true);
    });

    it("converts is_shared_publicly string 'false' to boolean false", async () => {
        mockSend.mockResolvedValue({ Item: makeTemplateRaw({ is_shared_publicly: "false" }) });

        const result = await repoModule.getTemplate("tpl-1");

        expect(result!.is_shared_publicly).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// listByOwner — DDB command inputs (complementing soft-delete.test.ts filtering tests)
// ---------------------------------------------------------------------------
describe("listByOwner — DDB command inputs", () => {
    it("queries gsi1 with correct IndexName and owner_teacher_id", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listByOwner("teacher-1");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.TableName).toBe("test-boss-battle-templates");
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.ExpressionAttributeValues[":oid"]).toBe("teacher-1");
    });

    it("converts is_shared_publicly string to boolean in returned items", async () => {
        mockSend.mockResolvedValue({
            Items: [makeTemplateRaw({ is_shared_publicly: "true" })],
        });

        const result = await repoModule.listByOwner("teacher-1");

        expect(result[0].is_shared_publicly).toBe(true);
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValue({ Items: undefined });

        const result = await repoModule.listByOwner("teacher-1");

        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// createTemplate
// ---------------------------------------------------------------------------
describe("createTemplate", () => {
    it("sends PutCommand with correct TableName", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.createTemplate(makeTemplateItem());

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.TableName).toBe("test-boss-battle-templates");
    });

    it("stores is_shared_publicly=true as string 'true'", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.createTemplate(makeTemplateItem({ is_shared_publicly: true }));

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Item.is_shared_publicly).toBe("true");
    });

    it("stores is_shared_publicly=false as string 'false'", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.createTemplate(makeTemplateItem({ is_shared_publicly: false }));

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Item.is_shared_publicly).toBe("false");
    });

    it("sets ConditionExpression to prevent duplicate IDs", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.createTemplate(makeTemplateItem());

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ConditionExpression).toBe("attribute_not_exists(boss_template_id)");
    });

    it("writes all item fields to DynamoDB", async () => {
        mockSend.mockResolvedValue({});
        const item = makeTemplateItem();

        await repoModule.createTemplate(item);

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Item.boss_template_id).toBe("tpl-1");
        expect(cmd.input.Item.owner_teacher_id).toBe("teacher-1");
        expect(cmd.input.Item.title).toBe("Dragon Boss");
        expect(cmd.input.Item.max_hp).toBe(1000);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DynamoDB error"));

        await expect(repoModule.createTemplate(makeTemplateItem()))
            .rejects.toThrow("DynamoDB error");
    });
});

// ---------------------------------------------------------------------------
// listPublic
// ---------------------------------------------------------------------------
describe("listPublic", () => {
    it("queries gsi2 with is_shared_publicly='true'", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listPublic();

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.TableName).toBe("test-boss-battle-templates");
        expect(cmd.input.IndexName).toBe("gsi2");
        expect(cmd.input.ExpressionAttributeValues[":is_public"]).toBe("true");
    });

    it("includes FilterExpression to exclude soft-deleted items", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listPublic();

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.FilterExpression).toContain("is_deleted");
        expect(cmd.input.ExpressionAttributeValues[":is_del_false"]).toBe(false);
    });

    it("adds begins_with condition when subjectPrefix is provided", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listPublic({ subjectPrefix: "MATH" });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.KeyConditionExpression).toContain("begins_with");
        expect(cmd.input.ExpressionAttributeValues[":subject_prefix"]).toBe("MATH#");
    });

    it("does not add begins_with when no subjectPrefix", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listPublic();

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.KeyConditionExpression).not.toContain("begins_with");
    });

    it("forwards Limit when provided", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listPublic({ limit: 25 });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Limit).toBe(25);
    });

    it("decodes cursor into ExclusiveStartKey", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        const key = { boss_template_id: "tpl-1", is_shared_publicly: "true" };
        const cursor = Buffer.from(JSON.stringify(key)).toString("base64");

        await repoModule.listPublic({ cursor });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExclusiveStartKey).toEqual(key);
    });

    it("encodes LastEvaluatedKey as cursor in response", async () => {
        const lek = { boss_template_id: "tpl-1", is_shared_publicly: "true" };
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: lek });

        const result = await repoModule.listPublic();

        expect(result.cursor).toBe(Buffer.from(JSON.stringify(lek)).toString("base64"));
    });

    it("returns undefined cursor when no more pages", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        const result = await repoModule.listPublic();

        expect(result.cursor).toBeUndefined();
    });

    it("converts is_shared_publicly string to boolean in returned items", async () => {
        mockSend.mockResolvedValue({
            Items: [makeTemplateRaw({ is_shared_publicly: "true" })],
        });

        const result = await repoModule.listPublic();

        expect(result.items[0].is_shared_publicly).toBe(true);
    });

    it("returns empty items array when Items is undefined", async () => {
        mockSend.mockResolvedValue({ Items: undefined });

        const result = await repoModule.listPublic();

        expect(result.items).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// updateTemplate
// ---------------------------------------------------------------------------
describe("updateTemplate", () => {
    it("sends UpdateCommand with correct TableName and Key", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.updateTemplate("tpl-1", { title: "New Title" });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.TableName).toBe("test-boss-battle-templates");
        expect(cmd.input.Key).toEqual({ boss_template_id: "tpl-1" });
    });

    it("uses ConditionExpression to prevent updates on non-existent items", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.updateTemplate("tpl-1", { title: "New Title" });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(boss_template_id)");
    });

    it("only includes title in UpdateExpression when only title is provided", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.updateTemplate("tpl-1", { title: "New Title" });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.UpdateExpression).toContain("title");
        expect(cmd.input.UpdateExpression).not.toContain("description");
        expect(cmd.input.UpdateExpression).not.toContain("max_hp");
    });

    it("includes all provided fields in UpdateExpression", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.updateTemplate("tpl-1", {
            title:       "New Title",
            description: "New description",
            max_hp:      500,
        });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.UpdateExpression).toContain("title");
        expect(cmd.input.UpdateExpression).toContain("description");
        expect(cmd.input.UpdateExpression).toContain("max_hp");
    });

    it("stores is_shared_publicly=true as string 'true'", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.updateTemplate("tpl-1", { is_shared_publicly: true });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExpressionAttributeValues[":is_shared_publicly"]).toBe("true");
    });

    it("stores is_shared_publicly=false as string 'false'", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.updateTemplate("tpl-1", { is_shared_publicly: false });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExpressionAttributeValues[":is_shared_publicly"]).toBe("false");
    });

    it("does NOT call DynamoDB when no fields are provided", async () => {
        await repoModule.updateTemplate("tpl-1", {});

        expect(mockSend).not.toHaveBeenCalled();
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("ServiceUnavailable"));

        await expect(repoModule.updateTemplate("tpl-1", { title: "x" }))
            .rejects.toThrow("ServiceUnavailable");
    });
});

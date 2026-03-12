/**
 * Unit tests for BossBattleTemplates soft-delete feature.
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the DynamoDB Document Client so no real AWS calls are made.
// vi.mock() calls are hoisted by Vitest before any imports, so these mocks
// are always in place when the repo/handler modules are first loaded.
// ---------------------------------------------------------------------------
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
    // Must be a real function (not arrow) so `new DynamoDBClient()` works
    DynamoDBClient: vi.fn(function () { return {}; }),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
    // All constructors must be regular functions so `new XxxCommand(...)` works
    DynamoDBDocumentClient: {
        from: vi.fn(function () { return { send: mockSend }; }),
    },
    PutCommand: vi.fn(function (input: any) { return { input }; }),
    GetCommand: vi.fn(function (input: any) { return { input }; }),
    QueryCommand: vi.fn(function (input: any) { return { input }; }),
    UpdateCommand: vi.fn(function (input: any) { return { input }; }),
}));

// ---------------------------------------------------------------------------
// Module references — populated in beforeAll so the env var is set first
// (the repo module throws at init if BOSS_BATTLE_TEMPLATES_TABLE_NAME is missing)
// ---------------------------------------------------------------------------
let repoModule: typeof import("../repo.ts");
let softDeleteHandler: (typeof import("../soft-delete.ts"))["handler"];
let restoreHandler: (typeof import("../restore.ts"))["handler"];

beforeAll(async () => {
    process.env.BOSS_BATTLE_TEMPLATES_TABLE_NAME = "test-boss-battle-templates";
    repoModule = await import("../repo.ts");
    softDeleteHandler = (await import("../soft-delete.ts")).handler;
    restoreHandler = (await import("../restore.ts")).handler;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTemplateRaw(overrides: Record<string, any> = {}) {
    return {
        boss_template_id: "tpl-1",
        owner_teacher_id: "teacher-1",
        title: "Dragon Boss",
        description: "Fight the dragon",
        max_hp: 1000,
        base_xp_reward: 200,
        base_gold_reward: 100,
        is_shared_publicly: "false",
        public_sort: "MATH#2024-01-01T00:00:00.000Z#tpl-1",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
        is_deleted: false,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// getTemplate — soft-delete filtering
// ---------------------------------------------------------------------------
describe("getTemplate", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("returns template when is_deleted=false", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeTemplateRaw() });
        const result = await repoModule.getTemplate("tpl-1");
        expect(result).not.toBeNull();
        expect(result?.is_deleted).toBe(false);
    });

    it("returns null for soft-deleted template (is_deleted=true)", async () => {
        mockSend.mockResolvedValueOnce({
            Item: makeTemplateRaw({ is_deleted: true, deleted_at: "2024-06-01T00:00:00.000Z" }),
        });
        const result = await repoModule.getTemplate("tpl-1");
        expect(result).toBeNull();
    });

    it("returns soft-deleted template when includeDeleted=true", async () => {
        mockSend.mockResolvedValueOnce({
            Item: makeTemplateRaw({ is_deleted: true }),
        });
        const result = await repoModule.getTemplate("tpl-1", { includeDeleted: true });
        expect(result?.is_deleted).toBe(true);
    });

    it("returns null when item does not exist", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const result = await repoModule.getTemplate("nonexistent");
        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// listByOwner — soft-delete filtering
// ---------------------------------------------------------------------------
describe("listByOwner", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("excludes soft-deleted templates by default", async () => {
        mockSend.mockResolvedValueOnce({
            Items: [
                makeTemplateRaw({ boss_template_id: "tpl-1", is_deleted: false }),
                makeTemplateRaw({ boss_template_id: "tpl-2", is_deleted: true }),
            ],
        });
        const items = await repoModule.listByOwner("teacher-1");
        expect(items).toHaveLength(1);
        expect(items[0].boss_template_id).toBe("tpl-1");
    });

    it("includes soft-deleted templates when includeDeleted=true", async () => {
        mockSend.mockResolvedValueOnce({
            Items: [
                makeTemplateRaw({ boss_template_id: "tpl-1", is_deleted: false }),
                makeTemplateRaw({ boss_template_id: "tpl-2", is_deleted: true }),
            ],
        });
        const items = await repoModule.listByOwner("teacher-1", { includeDeleted: true });
        expect(items).toHaveLength(2);
    });

    it("returns empty array when all templates are soft-deleted", async () => {
        mockSend.mockResolvedValueOnce({
            Items: [makeTemplateRaw({ is_deleted: true })],
        });
        const items = await repoModule.listByOwner("teacher-1");
        expect(items).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// softDeleteTemplate
// ---------------------------------------------------------------------------
describe("softDeleteTemplate", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("sets is_deleted=true, deleted_at, deleted_by_teacher_id, and updated_at", async () => {
        const deletedRaw = makeTemplateRaw({
            is_deleted: true,
            deleted_at: "2024-06-01T00:00:00.000Z",
            deleted_by_teacher_id: "teacher-1",
        });
        mockSend.mockResolvedValueOnce({ Attributes: deletedRaw });

        const result = await repoModule.softDeleteTemplate("tpl-1", "teacher-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;
        expect(params.ExpressionAttributeValues[":is_deleted"]).toBe(true);
        expect(params.ExpressionAttributeValues[":deleted_by"]).toBe("teacher-1");
        expect(params.ConditionExpression).toBe("attribute_exists(boss_template_id)");
        expect(params.ReturnValues).toBe("ALL_NEW");

        expect(result.is_deleted).toBe(true);
        expect(result.deleted_by_teacher_id).toBe("teacher-1");
    });

    it("throws ConditionalCheckFailedException for missing template", async () => {
        const err = new Error("Conditional check failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        await expect(
            repoModule.softDeleteTemplate("nonexistent", "teacher-1")
        ).rejects.toMatchObject({ name: "ConditionalCheckFailedException" });
    });
});

// ---------------------------------------------------------------------------
// restoreTemplate
// ---------------------------------------------------------------------------
describe("restoreTemplate", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("clears is_deleted and removes deleted_at / deleted_by_teacher_id", async () => {
        const restoredRaw = makeTemplateRaw({ is_deleted: false });
        mockSend.mockResolvedValueOnce({ Attributes: restoredRaw });

        const result = await repoModule.restoreTemplate("tpl-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;
        expect(params.ExpressionAttributeValues[":false"]).toBe(false);
        expect(params.UpdateExpression).toContain("REMOVE");
        expect(params.ConditionExpression).toBe("attribute_exists(boss_template_id)");

        expect(result.is_deleted).toBe(false);
        expect(result.deleted_at).toBeUndefined();
        expect(result.deleted_by_teacher_id).toBeUndefined();
    });

    it("throws ConditionalCheckFailedException for missing template", async () => {
        const err = new Error("Conditional check failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        await expect(repoModule.restoreTemplate("nonexistent")).rejects.toMatchObject({
            name: "ConditionalCheckFailedException",
        });
    });
});

// ---------------------------------------------------------------------------
// soft-delete handler
// ---------------------------------------------------------------------------
describe("soft-delete handler", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("returns 200 with deleted template on success", async () => {
        const deletedRaw = makeTemplateRaw({
            is_deleted: true,
            deleted_at: "2024-06-01T00:00:00.000Z",
            deleted_by_teacher_id: "teacher-1",
        });
        mockSend.mockResolvedValueOnce({ Attributes: deletedRaw });

        const event = {
            pathParameters: { boss_template_id: "tpl-1" },
            body: JSON.stringify({ deleted_by_teacher_id: "teacher-1" }),
        };
        const response = await softDeleteHandler(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.ok).toBe(true);
        expect(body.template.is_deleted).toBe(true);
    });

    it("returns 400 when boss_template_id is missing", async () => {
        const response = await softDeleteHandler({ pathParameters: {}, body: "{}" });
        expect(response.statusCode).toBe(400);
    });

    it("returns 400 when deleted_by_teacher_id is missing", async () => {
        const response = await softDeleteHandler({
            pathParameters: { boss_template_id: "tpl-1" },
            body: "{}",
        });
        expect(response.statusCode).toBe(400);
    });

    it("returns 404 when template does not exist", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const response = await softDeleteHandler({
            pathParameters: { boss_template_id: "nonexistent" },
            body: JSON.stringify({ deleted_by_teacher_id: "teacher-1" }),
        });
        expect(response.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// restore handler
// ---------------------------------------------------------------------------
describe("restore handler", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("returns 200 with restored template on success", async () => {
        const restoredRaw = makeTemplateRaw({ is_deleted: false });
        mockSend.mockResolvedValueOnce({ Attributes: restoredRaw });

        const event = { pathParameters: { boss_template_id: "tpl-1" }, body: "{}" };
        const response = await restoreHandler(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.ok).toBe(true);
        expect(body.template.is_deleted).toBe(false);
    });

    it("returns 400 when boss_template_id is missing", async () => {
        const response = await restoreHandler({ pathParameters: {}, body: "{}" });
        expect(response.statusCode).toBe(400);
    });

    it("returns 404 when template does not exist", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const response = await restoreHandler({
            pathParameters: { boss_template_id: "nonexistent" },
        });
        expect(response.statusCode).toBe(404);
    });
});

/**
 * Unit tests for guilds/repo.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/guilds
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DynamoDB
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
// Module references — env var must be set before dynamic import
// ---------------------------------------------------------------------------
let createGuild:      typeof import("../repo.ts").createGuild;
let getGuild:         typeof import("../repo.ts").getGuild;
let listGuildsByClass: typeof import("../repo.ts").listGuildsByClass;
let updateGuild:      typeof import("../repo.ts").updateGuild;
let deactivateGuild:  typeof import("../repo.ts").deactivateGuild;

beforeAll(async () => {
    process.env.GUILDS_TABLE_NAME = "test-guilds";
    const mod = await import("../repo.ts");
    createGuild      = mod.createGuild;
    getGuild         = mod.getGuild;
    listGuildsByClass = mod.listGuildsByClass;
    updateGuild      = mod.updateGuild;
    deactivateGuild  = mod.deactivateGuild;
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TS = "2026-04-10T00:00:00.000Z";

function makeGuild(overrides: Record<string, any> = {}) {
    return {
        guild_id:   "guild-1",
        class_id:   "class-1",
        name:       "Dragon Squad",
        is_active:  true,
        gsi1sk:     `${TS}#guild-1`,
        created_at: TS,
        updated_at: TS,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// createGuild
// ---------------------------------------------------------------------------
describe("createGuild", () => {
    it("sends PutCommand with correct TableName", async () => {
        mockSend.mockResolvedValue({});

        await createGuild(makeGuild());

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-guilds");
    });

    it("uses ConditionExpression attribute_not_exists(guild_id)", async () => {
        mockSend.mockResolvedValue({});

        await createGuild(makeGuild());

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ConditionExpression).toContain("attribute_not_exists");
        expect(cmd.input.ConditionExpression).toContain("guild_id");
    });

    it("writes all item fields", async () => {
        mockSend.mockResolvedValue({});
        const item = makeGuild({ name: "Phoenix" });

        await createGuild(item);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Item.name).toBe("Phoenix");
        expect(cmd.input.Item.class_id).toBe("class-1");
        expect(cmd.input.Item.is_active).toBe(true);
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(createGuild(makeGuild())).rejects.toMatchObject({
            name: "ConditionalCheckFailedException",
        });
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DynamoDB unavailable"));

        await expect(createGuild(makeGuild())).rejects.toThrow("DynamoDB unavailable");
    });
});

// ---------------------------------------------------------------------------
// getGuild
// ---------------------------------------------------------------------------
describe("getGuild", () => {
    it("sends GetCommand with correct TableName and Key", async () => {
        mockSend.mockResolvedValue({ Item: makeGuild() });

        await getGuild("guild-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-guilds");
        expect(cmd.input.Key).toEqual({ guild_id: "guild-1" });
    });

    it("returns the item when found", async () => {
        const item = makeGuild({ name: "Phoenix" });
        mockSend.mockResolvedValue({ Item: item });

        const result = await getGuild("guild-1");
        expect(result).toEqual(item);
    });

    it("returns null when item is not found", async () => {
        mockSend.mockResolvedValue({});

        const result = await getGuild("missing");
        expect(result).toBeNull();
    });

    it("propagates errors", async () => {
        mockSend.mockRejectedValue(new Error("ServiceUnavailable"));

        await expect(getGuild("guild-1")).rejects.toThrow("ServiceUnavailable");
    });
});

// ---------------------------------------------------------------------------
// listGuildsByClass
// ---------------------------------------------------------------------------
describe("listGuildsByClass", () => {
    it("queries gsi1 with class_id", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await listGuildsByClass("class-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.KeyConditionExpression).toContain("class_id");
        expect(cmd.input.ExpressionAttributeValues[":cid"]).toBe("class-1");
    });

    it("returns items and no nextCursor when no LastEvaluatedKey", async () => {
        const items = [makeGuild(), makeGuild({ guild_id: "guild-2" })];
        mockSend.mockResolvedValue({ Items: items });

        const result = await listGuildsByClass("class-1");
        expect(result.items).toHaveLength(2);
        expect(result.nextCursor).toBeUndefined();
    });

    it("returns base64 nextCursor when LastEvaluatedKey exists", async () => {
        const lek = { guild_id: "guild-5", class_id: "class-1", gsi1sk: "sk" };
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: lek });

        const result = await listGuildsByClass("class-1");
        expect(result.nextCursor).toBe(Buffer.from(JSON.stringify(lek)).toString("base64"));
    });

    it("decodes cursor and passes as ExclusiveStartKey", async () => {
        const lek = { guild_id: "guild-3", class_id: "class-1" };
        const cursor = Buffer.from(JSON.stringify(lek)).toString("base64");
        mockSend.mockResolvedValue({ Items: [] });

        await listGuildsByClass("class-1", 50, cursor);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lek);
    });

    it("passes limit to QueryCommand", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await listGuildsByClass("class-1", 20);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(20);
    });

    it("clamps limit to max 100", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await listGuildsByClass("class-1", 500);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(100);
    });

    it("clamps limit to min 1", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await listGuildsByClass("class-1", 0);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(1);
    });

    it("returns empty items when Items is undefined", async () => {
        mockSend.mockResolvedValue({});

        const result = await listGuildsByClass("class-1");
        expect(result.items).toEqual([]);
    });

    it("throws on invalid cursor", async () => {
        await expect(listGuildsByClass("class-1", 50, "!!!notjson!!!")).rejects.toThrow(
            "Invalid cursor format"
        );
    });
});

// ---------------------------------------------------------------------------
// updateGuild
// ---------------------------------------------------------------------------
describe("updateGuild", () => {
    it("sends UpdateCommand then GetCommand when name is patched", async () => {
        const updated = makeGuild({ name: "New Name" });
        // call 1: UpdateCommand; call 2: GetCommand (getGuild)
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: updated });

        const result = await updateGuild("guild-1", { name: "New Name" });

        expect(mockSend).toHaveBeenCalledTimes(2);
        expect(result?.name).toBe("New Name");
    });

    it("sends UpdateCommand then GetCommand when is_active is patched", async () => {
        const updated = makeGuild({ is_active: false });
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: updated });

        const result = await updateGuild("guild-1", { is_active: false });

        expect(mockSend).toHaveBeenCalledTimes(2);
        expect(result?.is_active).toBe(false);
    });

    it("skips UpdateCommand and calls GetCommand directly for empty patch", async () => {
        const guild = makeGuild();
        mockSend.mockResolvedValueOnce({ Item: guild });

        const result = await updateGuild("guild-1", {});

        // Only GetCommand — no UpdateCommand
        expect(mockSend).toHaveBeenCalledTimes(1);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toEqual({ guild_id: "guild-1" });
        expect(result?.name).toBe("Dragon Squad");
    });

    it("uses ConditionExpression attribute_exists(guild_id) in UpdateCommand", async () => {
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: makeGuild() });

        await updateGuild("guild-1", { name: "x" });

        const updateCmd = mockSend.mock.calls[0][0];
        expect(updateCmd.input.ConditionExpression).toContain("attribute_exists");
        expect(updateCmd.input.ConditionExpression).toContain("guild_id");
    });

    it("passes correct Key in UpdateCommand", async () => {
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: makeGuild() });

        await updateGuild("guild-99", { name: "y" });

        const updateCmd = mockSend.mock.calls[0][0];
        expect(updateCmd.input.Key).toEqual({ guild_id: "guild-99" });
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(updateGuild("guild-1", { name: "x" })).rejects.toMatchObject({
            name: "ConditionalCheckFailedException",
        });
    });
});

// ---------------------------------------------------------------------------
// deactivateGuild
// ---------------------------------------------------------------------------
describe("deactivateGuild", () => {
    it("sends UpdateCommand with is_active=false then GetCommand", async () => {
        const updated = makeGuild({ is_active: false });
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: updated });

        await deactivateGuild("guild-1");

        expect(mockSend).toHaveBeenCalledTimes(2);
        const updateCmd = mockSend.mock.calls[0][0];
        expect(updateCmd.input.TableName).toBe("test-guilds");
        expect(updateCmd.input.Key).toEqual({ guild_id: "guild-1" });
        expect(updateCmd.input.ExpressionAttributeValues[":is_active"]).toBe(false);
    });

    it("uses ConditionExpression attribute_exists(guild_id)", async () => {
        const updated = makeGuild({ is_active: false });
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: updated });

        await deactivateGuild("guild-1");

        const updateCmd = mockSend.mock.calls[0][0];
        expect(updateCmd.input.ConditionExpression).toContain("attribute_exists");
        expect(updateCmd.input.ConditionExpression).toContain("guild_id");
    });

    it("returns the deactivated guild", async () => {
        const updated = makeGuild({ is_active: false });
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: updated });

        const result = await deactivateGuild("guild-1");
        expect(result?.is_active).toBe(false);
    });

    it("returns null when GetCommand finds nothing after update", async () => {
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({});

        const result = await deactivateGuild("guild-1");
        expect(result).toBeNull();
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(deactivateGuild("guild-1")).rejects.toMatchObject({
            name: "ConditionalCheckFailedException",
        });
    });
});

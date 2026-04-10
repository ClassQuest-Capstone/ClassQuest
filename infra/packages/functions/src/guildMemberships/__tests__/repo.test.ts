/**
 * Unit tests for guildMemberships/repo.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/guildMemberships
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
let upsertMembership:      typeof import("../repo.ts").upsertMembership;
let getMembership:         typeof import("../repo.ts").getMembership;
let listMembersByGuild:    typeof import("../repo.ts").listMembersByGuild;
let listStudentMemberships: typeof import("../repo.ts").listStudentMemberships;
let leaveGuild:            typeof import("../repo.ts").leaveGuild;
let changeGuild:           typeof import("../repo.ts").changeGuild;

beforeAll(async () => {
    process.env.GUILD_MEMBERSHIPS_TABLE_NAME = "test-guild-memberships";
    const mod = await import("../repo.ts");
    upsertMembership       = mod.upsertMembership;
    getMembership          = mod.getMembership;
    listMembersByGuild     = mod.listMembersByGuild;
    listStudentMemberships = mod.listStudentMemberships;
    leaveGuild             = mod.leaveGuild;
    changeGuild            = mod.changeGuild;
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TS = "2026-04-10T00:00:00.000Z";

function makeMembership(overrides: Record<string, any> = {}) {
    return {
        class_id:       "class-1",
        student_id:     "student-1",
        guild_id:       "guild-1",
        role_in_guild:  "MEMBER" as const,
        joined_at:      TS,
        is_active:      true,
        updated_at:     TS,
        gsi1sk:         `${TS}#student-1`,
        gsi2sk:         `${TS}#class-1#guild-1`,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// upsertMembership
// ---------------------------------------------------------------------------
describe("upsertMembership", () => {
    it("sends PutCommand with correct TableName", async () => {
        mockSend.mockResolvedValue({});

        await upsertMembership(makeMembership());

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-guild-memberships");
    });

    it("writes all item fields to DynamoDB", async () => {
        mockSend.mockResolvedValue({});
        const item = makeMembership({ guild_id: "guild-xyz" });

        await upsertMembership(item);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Item.guild_id).toBe("guild-xyz");
        expect(cmd.input.Item.class_id).toBe("class-1");
        expect(cmd.input.Item.student_id).toBe("student-1");
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DynamoDB unavailable"));

        await expect(upsertMembership(makeMembership())).rejects.toThrow("DynamoDB unavailable");
    });
});

// ---------------------------------------------------------------------------
// getMembership
// ---------------------------------------------------------------------------
describe("getMembership", () => {
    it("sends GetCommand with correct TableName and Key", async () => {
        mockSend.mockResolvedValue({ Item: makeMembership() });

        await getMembership("class-1", "student-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-guild-memberships");
        expect(cmd.input.Key).toEqual({ class_id: "class-1", student_id: "student-1" });
    });

    it("returns the item when found", async () => {
        const item = makeMembership({ guild_id: "guild-99" });
        mockSend.mockResolvedValue({ Item: item });

        const result = await getMembership("class-1", "student-1");
        expect(result).toEqual(item);
    });

    it("returns null when item is not found", async () => {
        mockSend.mockResolvedValue({});

        const result = await getMembership("class-1", "missing-student");
        expect(result).toBeNull();
    });

    it("propagates errors", async () => {
        mockSend.mockRejectedValue(new Error("ServiceUnavailable"));

        await expect(getMembership("c-1", "s-1")).rejects.toThrow("ServiceUnavailable");
    });
});

// ---------------------------------------------------------------------------
// listMembersByGuild
// ---------------------------------------------------------------------------
describe("listMembersByGuild", () => {
    it("queries gsi1 with guild_id", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await listMembersByGuild("guild-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.KeyConditionExpression).toContain("guild_id");
        expect(cmd.input.ExpressionAttributeValues[":gid"]).toBe("guild-1");
    });

    it("returns items and no nextCursor when no LastEvaluatedKey", async () => {
        const items = [makeMembership(), makeMembership({ student_id: "s-2" })];
        mockSend.mockResolvedValue({ Items: items });

        const result = await listMembersByGuild("guild-1");
        expect(result.items).toHaveLength(2);
        expect(result.nextCursor).toBeUndefined();
    });

    it("returns base64 nextCursor when LastEvaluatedKey exists", async () => {
        const lek = { class_id: "c-1", student_id: "s-1", guild_id: "g-1", gsi1sk: "sk" };
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: lek });

        const result = await listMembersByGuild("guild-1");
        expect(result.nextCursor).toBe(Buffer.from(JSON.stringify(lek)).toString("base64"));
    });

    it("decodes cursor and passes as ExclusiveStartKey", async () => {
        const lek = { class_id: "c-1", student_id: "s-1" };
        const cursor = Buffer.from(JSON.stringify(lek)).toString("base64");
        mockSend.mockResolvedValue({ Items: [] });

        await listMembersByGuild("guild-1", 50, cursor);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lek);
    });

    it("passes limit to QueryCommand", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await listMembersByGuild("guild-1", 25);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(25);
    });

    it("clamps limit to max 100", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await listMembersByGuild("guild-1", 999);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(100);
    });

    it("clamps limit to min 1", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await listMembersByGuild("guild-1", 0);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(1);
    });

    it("returns empty items when Items is undefined", async () => {
        mockSend.mockResolvedValue({});

        const result = await listMembersByGuild("guild-1");
        expect(result.items).toEqual([]);
    });

    it("throws on invalid cursor", async () => {
        await expect(listMembersByGuild("guild-1", 50, "!!!notbase64json!!!")).rejects.toThrow(
            "Invalid cursor format"
        );
    });
});

// ---------------------------------------------------------------------------
// listStudentMemberships
// ---------------------------------------------------------------------------
describe("listStudentMemberships", () => {
    it("queries gsi2 with student_id", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await listStudentMemberships("student-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi2");
        expect(cmd.input.KeyConditionExpression).toContain("student_id");
        expect(cmd.input.ExpressionAttributeValues[":sid"]).toBe("student-1");
    });

    it("returns items and nextCursor", async () => {
        const lek = { student_id: "s-1", gsi2sk: "some-sk" };
        mockSend.mockResolvedValue({ Items: [makeMembership()], LastEvaluatedKey: lek });

        const result = await listStudentMemberships("student-1");
        expect(result.items).toHaveLength(1);
        expect(result.nextCursor).toBe(Buffer.from(JSON.stringify(lek)).toString("base64"));
    });

    it("decodes cursor and passes as ExclusiveStartKey", async () => {
        const lek = { student_id: "s-1", gsi2sk: "some-sk" };
        const cursor = Buffer.from(JSON.stringify(lek)).toString("base64");
        mockSend.mockResolvedValue({ Items: [] });

        await listStudentMemberships("student-1", 50, cursor);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lek);
    });

    it("clamps limit to max 100", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await listStudentMemberships("student-1", 200);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(100);
    });

    it("returns empty array when no results", async () => {
        mockSend.mockResolvedValue({ Items: undefined });

        const result = await listStudentMemberships("student-1");
        expect(result.items).toEqual([]);
    });

    it("throws on invalid cursor", async () => {
        await expect(listStudentMemberships("s-1", 50, "!!!bad!!!")).rejects.toThrow(
            "Invalid cursor format"
        );
    });
});

// ---------------------------------------------------------------------------
// leaveGuild
// ---------------------------------------------------------------------------
describe("leaveGuild", () => {
    it("sends UpdateCommand with correct Key and expression", async () => {
        const updated = makeMembership({ is_active: false });
        // call 1: UpdateCommand; call 2: GetCommand (getMembership)
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: updated });

        await leaveGuild("class-1", "student-1");

        const updateCmd = mockSend.mock.calls[0][0];
        expect(updateCmd.input.TableName).toBe("test-guild-memberships");
        expect(updateCmd.input.Key).toEqual({ class_id: "class-1", student_id: "student-1" });
        expect(updateCmd.input.UpdateExpression).toContain("is_active");
        expect(updateCmd.input.UpdateExpression).toContain("left_at");
        expect(updateCmd.input.ExpressionAttributeValues[":is_active"]).toBe(false);
    });

    it("uses ConditionExpression attribute_exists(class_id)", async () => {
        const updated = makeMembership({ is_active: false });
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: updated });

        await leaveGuild("class-1", "student-1");

        const updateCmd = mockSend.mock.calls[0][0];
        expect(updateCmd.input.ConditionExpression).toContain("attribute_exists");
        expect(updateCmd.input.ConditionExpression).toContain("class_id");
    });

    it("returns the updated membership after leave", async () => {
        const updated = makeMembership({ is_active: false, left_at: TS });
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: updated });

        const result = await leaveGuild("class-1", "student-1");
        expect(result?.is_active).toBe(false);
        expect(result?.left_at).toBe(TS);
    });

    it("returns null when getMembership returns nothing after update", async () => {
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({});

        const result = await leaveGuild("class-1", "student-1");
        expect(result).toBeNull();
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(leaveGuild("class-1", "student-1")).rejects.toMatchObject({
            name: "ConditionalCheckFailedException",
        });
    });
});

// ---------------------------------------------------------------------------
// changeGuild
// ---------------------------------------------------------------------------
describe("changeGuild", () => {
    it("sends UpdateCommand with new guild_id and recomputed gsi keys", async () => {
        const updated = makeMembership({ guild_id: "guild-new" });
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: updated });

        await changeGuild("class-1", "student-1", "guild-new", "MEMBER");

        const updateCmd = mockSend.mock.calls[0][0];
        expect(updateCmd.input.TableName).toBe("test-guild-memberships");
        expect(updateCmd.input.Key).toEqual({ class_id: "class-1", student_id: "student-1" });
        expect(updateCmd.input.UpdateExpression).toContain("guild_id");
        expect(updateCmd.input.UpdateExpression).toContain("gsi1sk");
        expect(updateCmd.input.UpdateExpression).toContain("gsi2sk");
        expect(updateCmd.input.UpdateExpression).toContain("REMOVE left_at");
        expect(updateCmd.input.ExpressionAttributeValues[":guild_id"]).toBe("guild-new");
        expect(updateCmd.input.ExpressionAttributeValues[":role"]).toBe("MEMBER");
        expect(updateCmd.input.ExpressionAttributeValues[":is_active"]).toBe(true);
    });

    it("uses ConditionExpression attribute_exists(class_id)", async () => {
        const updated = makeMembership({ guild_id: "guild-new" });
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: updated });

        await changeGuild("class-1", "student-1", "guild-new", "LEADER");

        const updateCmd = mockSend.mock.calls[0][0];
        expect(updateCmd.input.ConditionExpression).toContain("attribute_exists");
    });

    it("returns the updated membership", async () => {
        const updated = makeMembership({ guild_id: "guild-new", is_active: true });
        mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({ Item: updated });

        const result = await changeGuild("class-1", "student-1", "guild-new", "MEMBER");
        expect(result?.guild_id).toBe("guild-new");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(changeGuild("class-1", "student-1", "guild-new", "MEMBER")).rejects.toMatchObject({
            name: "ConditionalCheckFailedException",
        });
    });
});

/**
 * Unit tests for guildMemberships handlers:
 *   - get.ts
 *   - leave.ts
 *   - list-by-guild.ts
 *   - list-by-student.ts
 *   - upsert-membership.ts
 *
 * Repo is mocked; keys.ts and validation.ts run for real (pure functions).
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/guildMemberships
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock repo
// ---------------------------------------------------------------------------
const mockUpsertMembership       = vi.fn();
const mockGetMembership          = vi.fn();
const mockLeaveGuild             = vi.fn();
const mockChangeGuild            = vi.fn();
const mockListMembersByGuild     = vi.fn();
const mockListStudentMemberships = vi.fn();

vi.mock("../repo.ts", () => ({
    upsertMembership:       (...args: any[]) => mockUpsertMembership(...args),
    getMembership:          (...args: any[]) => mockGetMembership(...args),
    leaveGuild:             (...args: any[]) => mockLeaveGuild(...args),
    changeGuild:            (...args: any[]) => mockChangeGuild(...args),
    listMembersByGuild:     (...args: any[]) => mockListMembersByGuild(...args),
    listStudentMemberships: (...args: any[]) => mockListStudentMemberships(...args),
}));

// ---------------------------------------------------------------------------
// Module references
// ---------------------------------------------------------------------------
let getHandler:            (typeof import("../get.ts"))["handler"];
let leaveHandler:          (typeof import("../leave.ts"))["handler"];
let listByGuildHandler:    (typeof import("../list-by-guild.ts"))["handler"];
let listByStudentHandler:  (typeof import("../list-by-student.ts"))["handler"];
let upsertHandler:         (typeof import("../upsert-membership.ts"))["handler"];

beforeAll(async () => {
    getHandler           = (await import("../get.ts")).handler;
    leaveHandler         = (await import("../leave.ts")).handler;
    listByGuildHandler   = (await import("../list-by-guild.ts")).handler;
    listByStudentHandler = (await import("../list-by-student.ts")).handler;
    upsertHandler        = (await import("../upsert-membership.ts")).handler;
});

beforeEach(() => {
    mockUpsertMembership.mockReset();
    mockGetMembership.mockReset();
    mockLeaveGuild.mockReset();
    mockChangeGuild.mockReset();
    mockListMembersByGuild.mockReset();
    mockListStudentMemberships.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TS = "2026-04-10T00:00:00.000Z";

function makeMembership(overrides: Record<string, any> = {}) {
    return {
        class_id:      "class-1",
        student_id:    "student-1",
        guild_id:      "guild-1",
        role_in_guild: "MEMBER",
        joined_at:     TS,
        is_active:     true,
        updated_at:    TS,
        gsi1sk:        `${TS}#student-1`,
        gsi2sk:        `${TS}#class-1#guild-1`,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// get handler
// ---------------------------------------------------------------------------
describe("get handler", () => {
    it("returns 200 with membership body on success", async () => {
        const m = makeMembership();
        mockGetMembership.mockResolvedValue(m);

        const res = await getHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.class_id).toBe("class-1");
        expect(body.guild_id).toBe("guild-1");
    });

    it("returns 400 when class_id is missing", async () => {
        const res = await getHandler({
            pathParameters: { student_id: "student-1" },
        });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("class_id");
        expect(mockGetMembership).not.toHaveBeenCalled();
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await getHandler({
            pathParameters: { class_id: "class-1" },
        });

        expect(res.statusCode).toBe(400);
        expect(mockGetMembership).not.toHaveBeenCalled();
    });

    it("returns 400 when pathParameters is undefined", async () => {
        const res = await getHandler({ pathParameters: undefined });

        expect(res.statusCode).toBe(400);
        expect(mockGetMembership).not.toHaveBeenCalled();
    });

    it("returns 404 when membership is not found", async () => {
        mockGetMembership.mockResolvedValue(null);

        const res = await getHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
        });

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toContain("not found");
    });

    it("returns 500 when repo throws", async () => {
        mockGetMembership.mockRejectedValue(new Error("DynamoDB error"));

        const res = await getHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
        });

        expect(res.statusCode).toBe(500);
    });

    it("passes class_id and student_id to repo", async () => {
        mockGetMembership.mockResolvedValue(makeMembership());

        await getHandler({
            pathParameters: { class_id: "class-99", student_id: "student-99" },
        });

        expect(mockGetMembership).toHaveBeenCalledWith("class-99", "student-99");
    });
});

// ---------------------------------------------------------------------------
// leave handler
// ---------------------------------------------------------------------------
describe("leave handler", () => {
    it("returns 200 with updated membership on success", async () => {
        const updated = makeMembership({ is_active: false });
        mockLeaveGuild.mockResolvedValue(updated);

        const res = await leaveHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.is_active).toBe(false);
    });

    it("returns 400 when class_id is missing", async () => {
        const res = await leaveHandler({
            pathParameters: { student_id: "student-1" },
        });

        expect(res.statusCode).toBe(400);
        expect(mockLeaveGuild).not.toHaveBeenCalled();
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await leaveHandler({
            pathParameters: { class_id: "class-1" },
        });

        expect(res.statusCode).toBe(400);
        expect(mockLeaveGuild).not.toHaveBeenCalled();
    });

    it("returns 404 when leaveGuild returns null", async () => {
        mockLeaveGuild.mockResolvedValue(null);

        const res = await leaveHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
        });

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toContain("not found");
    });

    it("returns 404 when ConditionalCheckFailedException is thrown", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockLeaveGuild.mockRejectedValue(err);

        const res = await leaveHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
        });

        expect(res.statusCode).toBe(404);
    });

    it("returns 500 on generic repo error", async () => {
        mockLeaveGuild.mockRejectedValue(new Error("DynamoDB unavailable"));

        const res = await leaveHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
        });

        expect(res.statusCode).toBe(500);
    });

    it("passes class_id and student_id to repo", async () => {
        mockLeaveGuild.mockResolvedValue(makeMembership({ is_active: false }));

        await leaveHandler({
            pathParameters: { class_id: "class-99", student_id: "student-99" },
        });

        expect(mockLeaveGuild).toHaveBeenCalledWith("class-99", "student-99");
    });
});

// ---------------------------------------------------------------------------
// list-by-guild handler
// ---------------------------------------------------------------------------
describe("list-by-guild handler", () => {
    it("returns 200 with items, nextCursor, hasMore on success", async () => {
        mockListMembersByGuild.mockResolvedValue({
            items: [makeMembership()],
            nextCursor: "token123",
        });

        const res = await listByGuildHandler({
            pathParameters: { guild_id: "guild-1" },
            queryStringParameters: {},
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.nextCursor).toBe("token123");
        expect(body.hasMore).toBe(true);
    });

    it("returns hasMore=false when nextCursor is absent", async () => {
        mockListMembersByGuild.mockResolvedValue({ items: [], nextCursor: undefined });

        const res = await listByGuildHandler({
            pathParameters: { guild_id: "guild-1" },
            queryStringParameters: {},
        });

        const body = JSON.parse(res.body);
        expect(body.hasMore).toBe(false);
    });

    it("returns 400 when guild_id is missing", async () => {
        const res = await listByGuildHandler({
            pathParameters: undefined,
            queryStringParameters: {},
        });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("guild_id");
        expect(mockListMembersByGuild).not.toHaveBeenCalled();
    });

    it("returns 400 when limit is 0", async () => {
        const res = await listByGuildHandler({
            pathParameters: { guild_id: "guild-1" },
            queryStringParameters: { limit: "0" },
        });

        expect(res.statusCode).toBe(400);
        expect(mockListMembersByGuild).not.toHaveBeenCalled();
    });

    it("returns 400 when limit is not a number", async () => {
        const res = await listByGuildHandler({
            pathParameters: { guild_id: "guild-1" },
            queryStringParameters: { limit: "abc" },
        });

        expect(res.statusCode).toBe(400);
        expect(mockListMembersByGuild).not.toHaveBeenCalled();
    });

    it("passes parsed limit and cursor to repo", async () => {
        mockListMembersByGuild.mockResolvedValue({ items: [], nextCursor: undefined });

        await listByGuildHandler({
            pathParameters: { guild_id: "guild-1" },
            queryStringParameters: { limit: "20", cursor: "abc123" },
        });

        expect(mockListMembersByGuild).toHaveBeenCalledWith("guild-1", 20, "abc123");
    });

    it("works with no queryStringParameters", async () => {
        mockListMembersByGuild.mockResolvedValue({ items: [], nextCursor: undefined });

        const res = await listByGuildHandler({
            pathParameters: { guild_id: "guild-1" },
            queryStringParameters: undefined,
        });

        expect(res.statusCode).toBe(200);
    });

    it("returns 400 when repo throws 'Invalid cursor format'", async () => {
        mockListMembersByGuild.mockRejectedValue(new Error("Invalid cursor format"));

        const res = await listByGuildHandler({
            pathParameters: { guild_id: "guild-1" },
            queryStringParameters: {},
        });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("cursor");
    });

    it("returns 500 on generic repo error", async () => {
        mockListMembersByGuild.mockRejectedValue(new Error("DynamoDB error"));

        const res = await listByGuildHandler({
            pathParameters: { guild_id: "guild-1" },
            queryStringParameters: {},
        });

        expect(res.statusCode).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// list-by-student handler
// ---------------------------------------------------------------------------
describe("list-by-student handler", () => {
    it("returns 200 with items, nextCursor, hasMore on success", async () => {
        mockListStudentMemberships.mockResolvedValue({
            items: [makeMembership(), makeMembership({ class_id: "class-2" })],
            nextCursor: undefined,
        });

        const res = await listByStudentHandler({
            pathParameters: { student_id: "student-1" },
            queryStringParameters: {},
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(2);
        expect(body.hasMore).toBe(false);
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await listByStudentHandler({
            pathParameters: undefined,
            queryStringParameters: {},
        });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("student_id");
        expect(mockListStudentMemberships).not.toHaveBeenCalled();
    });

    it("returns 400 when limit is negative", async () => {
        const res = await listByStudentHandler({
            pathParameters: { student_id: "student-1" },
            queryStringParameters: { limit: "-5" },
        });

        expect(res.statusCode).toBe(400);
        expect(mockListStudentMemberships).not.toHaveBeenCalled();
    });

    it("returns 400 when limit is NaN", async () => {
        const res = await listByStudentHandler({
            pathParameters: { student_id: "student-1" },
            queryStringParameters: { limit: "xyz" },
        });

        expect(res.statusCode).toBe(400);
        expect(mockListStudentMemberships).not.toHaveBeenCalled();
    });

    it("passes parsed limit and cursor to repo", async () => {
        mockListStudentMemberships.mockResolvedValue({ items: [], nextCursor: undefined });

        await listByStudentHandler({
            pathParameters: { student_id: "student-1" },
            queryStringParameters: { limit: "10", cursor: "tok456" },
        });

        expect(mockListStudentMemberships).toHaveBeenCalledWith("student-1", 10, "tok456");
    });

    it("returns 400 when repo throws 'Invalid cursor format'", async () => {
        mockListStudentMemberships.mockRejectedValue(new Error("Invalid cursor format"));

        const res = await listByStudentHandler({
            pathParameters: { student_id: "student-1" },
            queryStringParameters: {},
        });

        expect(res.statusCode).toBe(400);
    });

    it("returns 500 on generic repo error", async () => {
        mockListStudentMemberships.mockRejectedValue(new Error("DynamoDB error"));

        const res = await listByStudentHandler({
            pathParameters: { student_id: "student-1" },
            queryStringParameters: {},
        });

        expect(res.statusCode).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// upsert-membership handler
// ---------------------------------------------------------------------------
describe("upsert-membership handler", () => {
    it("returns 201 with new membership when no existing membership", async () => {
        const created = makeMembership();
        mockGetMembership
            .mockResolvedValueOnce(null)   // check existing → none
            .mockResolvedValueOnce(created); // re-fetch after upsert
        mockUpsertMembership.mockResolvedValue(undefined);

        const res = await upsertHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
            body: JSON.stringify({ guild_id: "guild-1" }),
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.guild_id).toBe("guild-1");
    });

    it("returns 200 with updated membership when switching to a different guild", async () => {
        const existing = makeMembership({ guild_id: "guild-old" });
        const updated  = makeMembership({ guild_id: "guild-new" });
        mockGetMembership.mockResolvedValueOnce(existing);
        mockChangeGuild.mockResolvedValue(updated);

        const res = await upsertHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
            body: JSON.stringify({ guild_id: "guild-new" }),
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.guild_id).toBe("guild-new");
    });

    it("returns 200 when rejoining the same guild without role change", async () => {
        const existing = makeMembership({ guild_id: "guild-1" });
        mockGetMembership
            .mockResolvedValueOnce(existing)  // check existing
            .mockResolvedValueOnce(existing); // re-fetch (no update, role_in_guild not provided)

        const res = await upsertHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
            body: JSON.stringify({ guild_id: "guild-1" }),
        });

        expect(res.statusCode).toBe(200);
        expect(mockUpsertMembership).not.toHaveBeenCalled();
    });

    it("returns 200 and updates role when rejoining same guild with new role", async () => {
        const existing = makeMembership({ guild_id: "guild-1", role_in_guild: "MEMBER" });
        const updated  = makeMembership({ guild_id: "guild-1", role_in_guild: "LEADER" });
        mockGetMembership
            .mockResolvedValueOnce(existing)  // check existing
            .mockResolvedValueOnce(updated);  // re-fetch after upsert
        mockUpsertMembership.mockResolvedValue(undefined);

        const res = await upsertHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
            body: JSON.stringify({ guild_id: "guild-1", role_in_guild: "LEADER" }),
        });

        expect(res.statusCode).toBe(200);
        expect(mockUpsertMembership).toHaveBeenCalledWith(
            expect.objectContaining({ role_in_guild: "LEADER" })
        );
    });

    it("returns 400 when class_id is missing from path", async () => {
        const res = await upsertHandler({
            pathParameters: { student_id: "student-1" },
            body: JSON.stringify({ guild_id: "guild-1" }),
        });

        expect(res.statusCode).toBe(400);
        expect(mockGetMembership).not.toHaveBeenCalled();
    });

    it("returns 400 when student_id is missing from path", async () => {
        const res = await upsertHandler({
            pathParameters: { class_id: "class-1" },
            body: JSON.stringify({ guild_id: "guild-1" }),
        });

        expect(res.statusCode).toBe(400);
        expect(mockGetMembership).not.toHaveBeenCalled();
    });

    it("returns 400 when guild_id is missing from body", async () => {
        const res = await upsertHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
            body: JSON.stringify({}),
        });

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toContain("Validation");
        expect(body.details.some((d: any) => d.field === "guild_id")).toBe(true);
        expect(mockGetMembership).not.toHaveBeenCalled();
    });

    it("returns 400 when role_in_guild is invalid", async () => {
        const res = await upsertHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
            body: JSON.stringify({ guild_id: "guild-1", role_in_guild: "INVALID" }),
        });

        expect(res.statusCode).toBe(400);
        expect(mockGetMembership).not.toHaveBeenCalled();
    });

    it("defaults role_in_guild to MEMBER when not provided", async () => {
        mockGetMembership.mockResolvedValueOnce(null).mockResolvedValueOnce(makeMembership());
        mockUpsertMembership.mockResolvedValue(undefined);

        await upsertHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
            body: JSON.stringify({ guild_id: "guild-1" }),
        });

        const calledWith = mockUpsertMembership.mock.calls[0][0];
        expect(calledWith.role_in_guild).toBe("MEMBER");
    });

    it("returns 500 on repo error", async () => {
        mockGetMembership.mockRejectedValue(new Error("DynamoDB error"));

        const res = await upsertHandler({
            pathParameters: { class_id: "class-1", student_id: "student-1" },
            body: JSON.stringify({ guild_id: "guild-1" }),
        });

        expect(res.statusCode).toBe(500);
    });
});

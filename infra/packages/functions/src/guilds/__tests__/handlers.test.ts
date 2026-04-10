/**
 * Unit tests for guilds handlers:
 *   - create.ts
 *   - get.ts
 *   - update.ts
 *   - deactivate.ts
 *   - list-by-class.ts
 *
 * Repo is mocked; keys.ts and validation.ts run for real (pure functions).
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/guilds
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock repo
// ---------------------------------------------------------------------------
const mockCreateGuild       = vi.fn();
const mockGetGuild          = vi.fn();
const mockUpdateGuild       = vi.fn();
const mockDeactivateGuild   = vi.fn();
const mockListGuildsByClass = vi.fn();

vi.mock("../repo.ts", () => ({
    createGuild:       (...args: any[]) => mockCreateGuild(...args),
    getGuild:          (...args: any[]) => mockGetGuild(...args),
    updateGuild:       (...args: any[]) => mockUpdateGuild(...args),
    deactivateGuild:   (...args: any[]) => mockDeactivateGuild(...args),
    listGuildsByClass: (...args: any[]) => mockListGuildsByClass(...args),
}));

// ---------------------------------------------------------------------------
// Module references
// ---------------------------------------------------------------------------
let createHandler:      (typeof import("../create.ts"))["handler"];
let getHandler:         (typeof import("../get.ts"))["handler"];
let updateHandler:      (typeof import("../update.ts"))["handler"];
let deactivateHandler:  (typeof import("../deactivate.ts"))["handler"];
let listByClassHandler: (typeof import("../list-by-class.ts"))["handler"];

beforeAll(async () => {
    createHandler      = (await import("../create.ts")).handler;
    getHandler         = (await import("../get.ts")).handler;
    updateHandler      = (await import("../update.ts")).handler;
    deactivateHandler  = (await import("../deactivate.ts")).handler;
    listByClassHandler = (await import("../list-by-class.ts")).handler;
});

beforeEach(() => {
    mockCreateGuild.mockReset();
    mockGetGuild.mockReset();
    mockUpdateGuild.mockReset();
    mockDeactivateGuild.mockReset();
    mockListGuildsByClass.mockReset();
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
// create handler
// ---------------------------------------------------------------------------
describe("create handler", () => {
    it("returns 201 with guild_id on success", async () => {
        mockCreateGuild.mockResolvedValue(undefined);

        const res = await createHandler({
            pathParameters: { class_id: "class-1" },
            body: JSON.stringify({ name: "Dragon Squad" }),
        });

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.ok).toBe(true);
        expect(body.guild_id).toBeTruthy();
    });

    it("returns 400 when class_id is missing from path", async () => {
        const res = await createHandler({
            pathParameters: undefined,
            body: JSON.stringify({ name: "Dragon Squad" }),
        });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("class_id");
        expect(mockCreateGuild).not.toHaveBeenCalled();
    });

    it("returns 400 when name is missing", async () => {
        const res = await createHandler({
            pathParameters: { class_id: "class-1" },
            body: JSON.stringify({}),
        });

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toContain("Validation");
        expect(body.details.some((d: any) => d.field === "name")).toBe(true);
        expect(mockCreateGuild).not.toHaveBeenCalled();
    });

    it("returns 400 when name is empty string", async () => {
        const res = await createHandler({
            pathParameters: { class_id: "class-1" },
            body: JSON.stringify({ name: "   " }),
        });

        expect(res.statusCode).toBe(400);
        expect(mockCreateGuild).not.toHaveBeenCalled();
    });

    it("trims whitespace from name before saving", async () => {
        mockCreateGuild.mockResolvedValue(undefined);

        await createHandler({
            pathParameters: { class_id: "class-1" },
            body: JSON.stringify({ name: "  Dragon Squad  " }),
        });

        const calledWith = mockCreateGuild.mock.calls[0][0];
        expect(calledWith.name).toBe("Dragon Squad");
    });

    it("returns 409 when ConditionalCheckFailedException is thrown", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockCreateGuild.mockRejectedValue(err);

        const res = await createHandler({
            pathParameters: { class_id: "class-1" },
            body: JSON.stringify({ name: "Dragon Squad" }),
        });

        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toContain("already exists");
    });

    it("returns 500 on generic repo error", async () => {
        mockCreateGuild.mockRejectedValue(new Error("DynamoDB error"));

        const res = await createHandler({
            pathParameters: { class_id: "class-1" },
            body: JSON.stringify({ name: "Dragon Squad" }),
        });

        expect(res.statusCode).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// get handler
// ---------------------------------------------------------------------------
describe("get handler", () => {
    it("returns 200 with guild body on success", async () => {
        mockGetGuild.mockResolvedValue(makeGuild());

        const res = await getHandler({
            pathParameters: { guild_id: "guild-1" },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.guild_id).toBe("guild-1");
        expect(body.name).toBe("Dragon Squad");
    });

    it("returns 400 when guild_id is missing from path", async () => {
        const res = await getHandler({ pathParameters: undefined });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("guild_id");
        expect(mockGetGuild).not.toHaveBeenCalled();
    });

    it("returns 400 when pathParameters exists but guild_id is absent", async () => {
        const res = await getHandler({ pathParameters: {} });

        expect(res.statusCode).toBe(400);
        expect(mockGetGuild).not.toHaveBeenCalled();
    });

    it("returns 404 when guild is not found", async () => {
        mockGetGuild.mockResolvedValue(null);

        const res = await getHandler({
            pathParameters: { guild_id: "missing" },
        });

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toContain("not found");
    });

    it("returns 500 when repo throws", async () => {
        mockGetGuild.mockRejectedValue(new Error("DynamoDB error"));

        const res = await getHandler({
            pathParameters: { guild_id: "guild-1" },
        });

        expect(res.statusCode).toBe(500);
    });

    it("passes guild_id to repo", async () => {
        mockGetGuild.mockResolvedValue(makeGuild({ guild_id: "guild-xyz" }));

        await getHandler({ pathParameters: { guild_id: "guild-xyz" } });

        expect(mockGetGuild).toHaveBeenCalledWith("guild-xyz");
    });
});

// ---------------------------------------------------------------------------
// update handler
// ---------------------------------------------------------------------------
describe("update handler", () => {
    it("returns 200 with updated guild on success", async () => {
        const updated = makeGuild({ name: "Phoenix" });
        mockUpdateGuild.mockResolvedValue(updated);

        const res = await updateHandler({
            pathParameters: { guild_id: "guild-1" },
            body: JSON.stringify({ name: "Phoenix" }),
        });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).name).toBe("Phoenix");
    });

    it("returns 400 when guild_id is missing from path", async () => {
        const res = await updateHandler({
            pathParameters: undefined,
            body: JSON.stringify({ name: "Phoenix" }),
        });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("guild_id");
        expect(mockUpdateGuild).not.toHaveBeenCalled();
    });

    it("returns 400 when name validation fails", async () => {
        const res = await updateHandler({
            pathParameters: { guild_id: "guild-1" },
            body: JSON.stringify({ name: "" }),
        });

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toContain("Validation");
        expect(mockUpdateGuild).not.toHaveBeenCalled();
    });

    it("returns 400 when is_active is not a boolean", async () => {
        const res = await updateHandler({
            pathParameters: { guild_id: "guild-1" },
            body: JSON.stringify({ is_active: "yes" }),
        });

        expect(res.statusCode).toBe(400);
        expect(mockUpdateGuild).not.toHaveBeenCalled();
    });

    it("returns 404 when updateGuild returns null", async () => {
        mockUpdateGuild.mockResolvedValue(null);

        const res = await updateHandler({
            pathParameters: { guild_id: "guild-1" },
            body: JSON.stringify({ name: "Phoenix" }),
        });

        expect(res.statusCode).toBe(404);
    });

    it("returns 404 when ConditionalCheckFailedException is thrown", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockUpdateGuild.mockRejectedValue(err);

        const res = await updateHandler({
            pathParameters: { guild_id: "guild-1" },
            body: JSON.stringify({ name: "Phoenix" }),
        });

        expect(res.statusCode).toBe(404);
    });

    it("returns 500 on generic repo error", async () => {
        mockUpdateGuild.mockRejectedValue(new Error("DynamoDB error"));

        const res = await updateHandler({
            pathParameters: { guild_id: "guild-1" },
            body: JSON.stringify({ name: "Phoenix" }),
        });

        expect(res.statusCode).toBe(500);
    });

    it("passes trimmed name to repo", async () => {
        mockUpdateGuild.mockResolvedValue(makeGuild({ name: "Phoenix" }));

        await updateHandler({
            pathParameters: { guild_id: "guild-1" },
            body: JSON.stringify({ name: "  Phoenix  " }),
        });

        expect(mockUpdateGuild).toHaveBeenCalledWith(
            "guild-1",
            expect.objectContaining({ name: "Phoenix" })
        );
    });

    it("passes is_active to repo when provided", async () => {
        mockUpdateGuild.mockResolvedValue(makeGuild({ is_active: false }));

        await updateHandler({
            pathParameters: { guild_id: "guild-1" },
            body: JSON.stringify({ is_active: false }),
        });

        expect(mockUpdateGuild).toHaveBeenCalledWith(
            "guild-1",
            expect.objectContaining({ is_active: false })
        );
    });
});

// ---------------------------------------------------------------------------
// deactivate handler
// ---------------------------------------------------------------------------
describe("deactivate handler", () => {
    it("returns 200 with deactivated guild on success", async () => {
        const updated = makeGuild({ is_active: false });
        mockDeactivateGuild.mockResolvedValue(updated);

        const res = await deactivateHandler({
            pathParameters: { guild_id: "guild-1" },
        });

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).is_active).toBe(false);
    });

    it("returns 400 when guild_id is missing from path", async () => {
        const res = await deactivateHandler({ pathParameters: undefined });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("guild_id");
        expect(mockDeactivateGuild).not.toHaveBeenCalled();
    });

    it("returns 400 when pathParameters exists but guild_id is absent", async () => {
        const res = await deactivateHandler({ pathParameters: {} });

        expect(res.statusCode).toBe(400);
        expect(mockDeactivateGuild).not.toHaveBeenCalled();
    });

    it("returns 404 when deactivateGuild returns null", async () => {
        mockDeactivateGuild.mockResolvedValue(null);

        const res = await deactivateHandler({
            pathParameters: { guild_id: "guild-1" },
        });

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toContain("not found");
    });

    it("returns 404 when ConditionalCheckFailedException is thrown", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockDeactivateGuild.mockRejectedValue(err);

        const res = await deactivateHandler({
            pathParameters: { guild_id: "guild-1" },
        });

        expect(res.statusCode).toBe(404);
    });

    it("returns 500 on generic repo error", async () => {
        mockDeactivateGuild.mockRejectedValue(new Error("DynamoDB error"));

        const res = await deactivateHandler({
            pathParameters: { guild_id: "guild-1" },
        });

        expect(res.statusCode).toBe(500);
    });

    it("passes guild_id to repo", async () => {
        mockDeactivateGuild.mockResolvedValue(makeGuild({ is_active: false }));

        await deactivateHandler({ pathParameters: { guild_id: "guild-99" } });

        expect(mockDeactivateGuild).toHaveBeenCalledWith("guild-99");
    });
});

// ---------------------------------------------------------------------------
// list-by-class handler
// ---------------------------------------------------------------------------
describe("list-by-class handler", () => {
    it("returns 200 with items, nextCursor, hasMore on success", async () => {
        mockListGuildsByClass.mockResolvedValue({
            items: [makeGuild(), makeGuild({ guild_id: "guild-2" })],
            nextCursor: "token123",
        });

        const res = await listByClassHandler({
            pathParameters: { class_id: "class-1" },
            queryStringParameters: {},
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(2);
        expect(body.nextCursor).toBe("token123");
        expect(body.hasMore).toBe(true);
    });

    it("returns hasMore=false when nextCursor is absent", async () => {
        mockListGuildsByClass.mockResolvedValue({ items: [], nextCursor: undefined });

        const res = await listByClassHandler({
            pathParameters: { class_id: "class-1" },
            queryStringParameters: {},
        });

        const body = JSON.parse(res.body);
        expect(body.hasMore).toBe(false);
        expect(body.items).toEqual([]);
    });

    it("returns 400 when class_id is missing", async () => {
        const res = await listByClassHandler({
            pathParameters: undefined,
            queryStringParameters: {},
        });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("class_id");
        expect(mockListGuildsByClass).not.toHaveBeenCalled();
    });

    it("returns 400 when limit is 0", async () => {
        const res = await listByClassHandler({
            pathParameters: { class_id: "class-1" },
            queryStringParameters: { limit: "0" },
        });

        expect(res.statusCode).toBe(400);
        expect(mockListGuildsByClass).not.toHaveBeenCalled();
    });

    it("returns 400 when limit is not a number", async () => {
        const res = await listByClassHandler({
            pathParameters: { class_id: "class-1" },
            queryStringParameters: { limit: "abc" },
        });

        expect(res.statusCode).toBe(400);
        expect(mockListGuildsByClass).not.toHaveBeenCalled();
    });

    it("passes parsed limit and cursor to repo", async () => {
        mockListGuildsByClass.mockResolvedValue({ items: [], nextCursor: undefined });

        await listByClassHandler({
            pathParameters: { class_id: "class-1" },
            queryStringParameters: { limit: "15", cursor: "abc123" },
        });

        expect(mockListGuildsByClass).toHaveBeenCalledWith("class-1", 15, "abc123");
    });

    it("works with no queryStringParameters", async () => {
        mockListGuildsByClass.mockResolvedValue({ items: [], nextCursor: undefined });

        const res = await listByClassHandler({
            pathParameters: { class_id: "class-1" },
            queryStringParameters: undefined,
        });

        expect(res.statusCode).toBe(200);
    });

    it("returns 400 when repo throws 'Invalid cursor format'", async () => {
        mockListGuildsByClass.mockRejectedValue(new Error("Invalid cursor format"));

        const res = await listByClassHandler({
            pathParameters: { class_id: "class-1" },
            queryStringParameters: {},
        });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("cursor");
    });

    it("returns 500 on generic repo error", async () => {
        mockListGuildsByClass.mockRejectedValue(new Error("DynamoDB error"));

        const res = await listByClassHandler({
            pathParameters: { class_id: "class-1" },
            queryStringParameters: {},
        });

        expect(res.statusCode).toBe(500);
    });
});

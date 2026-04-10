/**
 * Unit tests for bossBattleTemplates handlers:
 *   - create.ts
 *   - get.ts
 *   - list-by-owner.ts
 *   - list-public.ts
 *
 * Note: soft-delete.ts and restore.ts are already covered in soft-delete.test.ts.
 *
 * Repo is mocked; validation.ts and keys.ts run for real (pure functions).
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/bossBattleTemplates
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock repo — keeps tests focused on handler logic
// ---------------------------------------------------------------------------
const mockCreateTemplate  = vi.fn();
const mockGetTemplate     = vi.fn();
const mockListByOwner     = vi.fn();
const mockListPublic      = vi.fn();

vi.mock("../repo.ts", () => ({
    createTemplate: (...args: any[]) => mockCreateTemplate(...args),
    getTemplate:    (...args: any[]) => mockGetTemplate(...args),
    listByOwner:    (...args: any[]) => mockListByOwner(...args),
    listPublic:     (...args: any[]) => mockListPublic(...args),
}));

// ---------------------------------------------------------------------------
// Module references
// ---------------------------------------------------------------------------
let createHandler:      (typeof import("../create.ts"))["handler"];
let getHandler:         (typeof import("../get.ts"))["handler"];
let listByOwnerHandler: (typeof import("../list-by-owner.ts"))["handler"];
let listPublicHandler:  (typeof import("../list-public.ts"))["handler"];

beforeAll(async () => {
    createHandler      = (await import("../create.ts")).handler;
    getHandler         = (await import("../get.ts")).handler;
    listByOwnerHandler = (await import("../list-by-owner.ts")).handler;
    listPublicHandler  = (await import("../list-public.ts")).handler;
});

beforeEach(() => {
    mockCreateTemplate.mockReset();
    mockGetTemplate.mockReset();
    mockListByOwner.mockReset();
    mockListPublic.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTemplateItem(overrides: Record<string, any> = {}) {
    return {
        boss_template_id:   "tpl-1",
        owner_teacher_id:   "teacher-1",
        title:              "Dragon Boss",
        description:        "Fight the dragon",
        subject:            "MATH",
        max_hp:             1000,
        base_xp_reward:     200,
        base_gold_reward:   100,
        is_shared_publicly: false,
        public_sort:        "MATH#2024-01-01T00:00:00.000Z#tpl-1",
        created_at:         "2024-01-01T00:00:00.000Z",
        updated_at:         "2024-01-01T00:00:00.000Z",
        is_deleted:         false,
        ...overrides,
    };
}

function makeValidBody(overrides: Record<string, any> = {}) {
    return {
        owner_teacher_id:   "teacher-1",
        title:              "Dragon Boss",
        description:        "Fight the dragon",
        max_hp:             1000,
        base_xp_reward:     200,
        base_gold_reward:   100,
        is_shared_publicly: false,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// create handler
// ---------------------------------------------------------------------------
describe("create handler", () => {
    it("returns 201 with boss_template_id on success", async () => {
        mockCreateTemplate.mockResolvedValue(undefined);

        const res = await createHandler({
            body: JSON.stringify(makeValidBody()),
        } as any);

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.boss_template_id).toBeTruthy();
        expect(body.message).toContain("created");
    });

    it("returns 400 when owner_teacher_id is missing", async () => {
        const res = await createHandler({
            body: JSON.stringify(makeValidBody({ owner_teacher_id: undefined })),
        } as any);

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.required).toContain("owner_teacher_id");
        expect(mockCreateTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 when title is missing", async () => {
        const res = await createHandler({
            body: JSON.stringify(makeValidBody({ title: undefined })),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(mockCreateTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 when max_hp is missing", async () => {
        const res = await createHandler({
            body: JSON.stringify(makeValidBody({ max_hp: undefined })),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(mockCreateTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 when is_shared_publicly is missing", async () => {
        const res = await createHandler({
            body: JSON.stringify(makeValidBody({ is_shared_publicly: undefined })),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(mockCreateTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 when validation fails — invalid max_hp", async () => {
        const res = await createHandler({
            body: JSON.stringify(makeValidBody({ max_hp: -1 })),
        } as any);

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toContain("max_hp");
        expect(mockCreateTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 when validation fails — is_shared_publicly is not boolean", async () => {
        const res = await createHandler({
            body: JSON.stringify(makeValidBody({ is_shared_publicly: "yes" })),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(mockCreateTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 when validation fails — empty title", async () => {
        const res = await createHandler({
            body: JSON.stringify(makeValidBody({ title: "   " })),
        } as any);

        expect(res.statusCode).toBe(400);
        expect(mockCreateTemplate).not.toHaveBeenCalled();
    });

    it("returns 409 when ConditionalCheckFailedException is thrown", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockCreateTemplate.mockRejectedValue(err);

        const res = await createHandler({
            body: JSON.stringify(makeValidBody()),
        } as any);

        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toContain("already exists");
    });

    it("returns 500 on unexpected repo error", async () => {
        mockCreateTemplate.mockRejectedValue(new Error("DynamoDB unavailable"));

        const res = await createHandler({
            body: JSON.stringify(makeValidBody()),
        } as any);

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("DynamoDB unavailable");
    });

    it("trims whitespace from title and description", async () => {
        mockCreateTemplate.mockResolvedValue(undefined);

        await createHandler({
            body: JSON.stringify(makeValidBody({ title: "  Dragon Boss  ", description: "  desc  " })),
        } as any);

        const calledWith = mockCreateTemplate.mock.calls[0][0];
        expect(calledWith.title).toBe("Dragon Boss");
        expect(calledWith.description).toBe("desc");
    });

    it("handles missing body gracefully (treats as empty object → 400)", async () => {
        const res = await createHandler({ body: undefined } as any);

        expect(res.statusCode).toBe(400);
        expect(mockCreateTemplate).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// get handler
// ---------------------------------------------------------------------------
describe("get handler", () => {
    it("returns 200 with template body on success", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplateItem());

        const res = await getHandler({
            pathParameters: { boss_template_id: "tpl-1" },
        } as any);

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.boss_template_id).toBe("tpl-1");
        expect(body.title).toBe("Dragon Boss");
    });

    it("returns 400 when boss_template_id is missing from path", async () => {
        const res = await getHandler({ pathParameters: {} } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("boss_template_id");
        expect(mockGetTemplate).not.toHaveBeenCalled();
    });

    it("returns 400 when pathParameters is undefined", async () => {
        const res = await getHandler({ pathParameters: undefined } as any);

        expect(res.statusCode).toBe(400);
        expect(mockGetTemplate).not.toHaveBeenCalled();
    });

    it("returns 404 when template is not found", async () => {
        mockGetTemplate.mockResolvedValue(null);

        const res = await getHandler({
            pathParameters: { boss_template_id: "missing" },
        } as any);

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toContain("not found");
    });

    it("returns 500 when repo throws", async () => {
        mockGetTemplate.mockRejectedValue(new Error("ServiceUnavailable"));

        const res = await getHandler({
            pathParameters: { boss_template_id: "tpl-1" },
        } as any);

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("ServiceUnavailable");
    });

    it("passes boss_template_id to repo", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplateItem({ boss_template_id: "tpl-abc" }));

        await getHandler({
            pathParameters: { boss_template_id: "tpl-abc" },
        } as any);

        expect(mockGetTemplate).toHaveBeenCalledWith("tpl-abc");
    });
});

// ---------------------------------------------------------------------------
// list-by-owner handler
// ---------------------------------------------------------------------------
describe("list-by-owner handler", () => {
    it("returns 200 with items array on success", async () => {
        mockListByOwner.mockResolvedValue([makeTemplateItem(), makeTemplateItem({ boss_template_id: "tpl-2" })]);

        const res = await listByOwnerHandler({
            pathParameters: { teacher_id: "teacher-1" },
        } as any);

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(2);
    });

    it("returns 400 when teacher_id is missing from path", async () => {
        const res = await listByOwnerHandler({ pathParameters: {} } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("teacher_id");
        expect(mockListByOwner).not.toHaveBeenCalled();
    });

    it("returns 400 when pathParameters is undefined", async () => {
        const res = await listByOwnerHandler({ pathParameters: undefined } as any);

        expect(res.statusCode).toBe(400);
        expect(mockListByOwner).not.toHaveBeenCalled();
    });

    it("returns 200 with empty items when owner has no templates", async () => {
        mockListByOwner.mockResolvedValue([]);

        const res = await listByOwnerHandler({
            pathParameters: { teacher_id: "teacher-1" },
        } as any);

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).items).toEqual([]);
    });

    it("passes teacher_id to repo", async () => {
        mockListByOwner.mockResolvedValue([]);

        await listByOwnerHandler({
            pathParameters: { teacher_id: "teacher-abc" },
        } as any);

        expect(mockListByOwner).toHaveBeenCalledWith("teacher-abc");
    });

    it("returns 500 when repo throws", async () => {
        mockListByOwner.mockRejectedValue(new Error("DynamoDB error"));

        const res = await listByOwnerHandler({
            pathParameters: { teacher_id: "teacher-1" },
        } as any);

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("DynamoDB error");
    });
});

// ---------------------------------------------------------------------------
// list-public handler
// ---------------------------------------------------------------------------
describe("list-public handler", () => {
    it("returns 200 with items and no cursor on success", async () => {
        mockListPublic.mockResolvedValue({
            items: [makeTemplateItem({ is_shared_publicly: true })],
            cursor: undefined,
        });

        const res = await listPublicHandler({
            queryStringParameters: {},
        } as any);

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.cursor).toBeUndefined();
    });

    it("returns 200 with cursor when more pages exist", async () => {
        mockListPublic.mockResolvedValue({
            items: [makeTemplateItem({ is_shared_publicly: true })],
            cursor: "nextpagetoken==",
        });

        const res = await listPublicHandler({
            queryStringParameters: { limit: "10" },
        } as any);

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.cursor).toBe("nextpagetoken==");
    });

    it("returns 400 when limit is 0", async () => {
        const res = await listPublicHandler({
            queryStringParameters: { limit: "0" },
        } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("limit");
        expect(mockListPublic).not.toHaveBeenCalled();
    });

    it("returns 400 when limit exceeds 100", async () => {
        const res = await listPublicHandler({
            queryStringParameters: { limit: "101" },
        } as any);

        expect(res.statusCode).toBe(400);
        expect(mockListPublic).not.toHaveBeenCalled();
    });

    it("returns 400 when limit is not a number", async () => {
        const res = await listPublicHandler({
            queryStringParameters: { limit: "abc" },
        } as any);

        expect(res.statusCode).toBe(400);
        expect(mockListPublic).not.toHaveBeenCalled();
    });

    it("passes subject as subjectPrefix to repo", async () => {
        mockListPublic.mockResolvedValue({ items: [], cursor: undefined });

        await listPublicHandler({
            queryStringParameters: { subject: "MATH" },
        } as any);

        expect(mockListPublic).toHaveBeenCalledWith(
            expect.objectContaining({ subjectPrefix: "MATH" })
        );
    });

    it("passes parsed limit as number to repo", async () => {
        mockListPublic.mockResolvedValue({ items: [], cursor: undefined });

        await listPublicHandler({
            queryStringParameters: { limit: "20" },
        } as any);

        expect(mockListPublic).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 20 })
        );
    });

    it("passes cursor to repo", async () => {
        mockListPublic.mockResolvedValue({ items: [], cursor: undefined });

        await listPublicHandler({
            queryStringParameters: { cursor: "abc123token" },
        } as any);

        expect(mockListPublic).toHaveBeenCalledWith(
            expect.objectContaining({ cursor: "abc123token" })
        );
    });

    it("returns 200 with empty items when no public templates", async () => {
        mockListPublic.mockResolvedValue({ items: [], cursor: undefined });

        const res = await listPublicHandler({
            queryStringParameters: {},
        } as any);

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).items).toEqual([]);
    });

    it("works with no queryStringParameters", async () => {
        mockListPublic.mockResolvedValue({ items: [], cursor: undefined });

        const res = await listPublicHandler({
            queryStringParameters: undefined,
        } as any);

        expect(res.statusCode).toBe(200);
    });

    it("returns 500 when repo throws", async () => {
        mockListPublic.mockRejectedValue(new Error("ServiceUnavailable"));

        const res = await listPublicHandler({
            queryStringParameters: {},
        } as any);

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("ServiceUnavailable");
    });
});

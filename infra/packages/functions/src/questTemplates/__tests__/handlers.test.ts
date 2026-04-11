import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Repo mock                                                          */
/* ------------------------------------------------------------------ */
const mockCreateTemplate    = vi.fn();
const mockGetTemplate       = vi.fn();
const mockListByOwner       = vi.fn();
const mockListPublic        = vi.fn();
const mockUpdateTemplate    = vi.fn();
const mockSoftDeleteTemplate = vi.fn();

vi.mock("../repo.ts", () => ({
    createTemplate:     (...args: any[]) => mockCreateTemplate(...args),
    getTemplate:        (...args: any[]) => mockGetTemplate(...args),
    listByOwner:        (...args: any[]) => mockListByOwner(...args),
    listPublic:         (...args: any[]) => mockListPublic(...args),
    updateTemplate:     (...args: any[]) => mockUpdateTemplate(...args),
    softDeleteTemplate: (...args: any[]) => mockSoftDeleteTemplate(...args),
}));

// soft-delete.ts imports from "./repo.js" — mirror full mock so Vitest resolution works
vi.mock("../repo.js", () => ({
    createTemplate:     (...args: any[]) => mockCreateTemplate(...args),
    getTemplate:        (...args: any[]) => mockGetTemplate(...args),
    listByOwner:        (...args: any[]) => mockListByOwner(...args),
    listPublic:         (...args: any[]) => mockListPublic(...args),
    updateTemplate:     (...args: any[]) => mockUpdateTemplate(...args),
    softDeleteTemplate: (...args: any[]) => mockSoftDeleteTemplate(...args),
}));

/* ------------------------------------------------------------------ */
/*  Handler imports (dynamic)                                          */
/* ------------------------------------------------------------------ */
let createHandler:     (typeof import("../create.ts"))["handler"];
let getHandler:        (typeof import("../get.ts"))["handler"];
let updateHandler:     (typeof import("../update.ts"))["handler"];
let softDeleteHandler: (typeof import("../soft-delete.ts"))["handler"];
let listByOwnerHandler:(typeof import("../list-by-owner.ts"))["handler"];
let listPublicHandler: (typeof import("../list-public.ts"))["handler"];

beforeAll(async () => {
    createHandler      = (await import("../create.ts")).handler;
    getHandler         = (await import("../get.ts")).handler;
    updateHandler      = (await import("../update.ts")).handler;
    softDeleteHandler  = (await import("../soft-delete.ts")).handler;
    listByOwnerHandler = (await import("../list-by-owner.ts")).handler;
    listPublicHandler  = (await import("../list-public.ts")).handler;
});

beforeEach(() => {
    mockCreateTemplate.mockReset();
    mockGetTemplate.mockReset();
    mockListByOwner.mockReset();
    mockListPublic.mockReset();
    mockUpdateTemplate.mockReset();
    mockSoftDeleteTemplate.mockReset();
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function makeEvent(overrides: {
    body?: object | string;
    pathParameters?: Record<string, string>;
    queryStringParameters?: Record<string, string>;
} = {}) {
    return {
        body: overrides.body
            ? typeof overrides.body === "string"
                ? overrides.body
                : JSON.stringify(overrides.body)
            : undefined,
        pathParameters: overrides.pathParameters,
        queryStringParameters: overrides.queryStringParameters ?? undefined,
    };
}

function parseBody(res: any) {
    return JSON.parse(res.body);
}

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
/*  create handler                                                     */
/* ================================================================== */
describe("create handler", () => {
    const validBody = {
        owner_teacher_id: "teacher-1",
        title: "Math Quest",
        description: "A quest",
        subject: "Mathematics",
        class_id: "class-1",
        estimated_duration_minutes: 30,
        base_xp_reward: 100,
        base_gold_reward: 50,
        is_shared_publicly: true,
        type: "QUEST",
        grade: 6,
        difficulty: "MEDIUM",
    };

    it("returns 201 on success", async () => {
        mockCreateTemplate.mockResolvedValue(undefined);

        const res = await createHandler(makeEvent({ body: validBody }));

        expect(res.statusCode).toBe(201);
        const body = parseBody(res);
        expect(body.quest_template_id).toBeDefined();
        expect(body.message).toContain("created");
        expect(mockCreateTemplate).toHaveBeenCalledOnce();
    });

    it("forwards all fields to repo", async () => {
        mockCreateTemplate.mockResolvedValue(undefined);

        await createHandler(makeEvent({ body: validBody }));

        const item = mockCreateTemplate.mock.calls[0][0];
        expect(item.owner_teacher_id).toBe("teacher-1");
        expect(item.title).toBe("Math Quest");
        expect(item.subject).toBe("Mathematics");
        expect(item.visibility_pk).toBe("PUBLIC");
        expect(item.type).toBe("QUEST");
    });

    it("returns 400 when owner_teacher_id is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { title: "X" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_REQUIRED_FIELDS");
    });

    it("returns 400 when title is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { owner_teacher_id: "t-1" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_REQUIRED_FIELDS");
    });

    it("returns 400 for empty title", async () => {
        const res = await createHandler(
            makeEvent({ body: { ...validBody, title: "  " } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_TITLE");
    });

    it("returns 400 for negative base_xp_reward", async () => {
        const res = await createHandler(
            makeEvent({ body: { ...validBody, base_xp_reward: -1 } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_BASE_XP_REWARD");
    });

    it("returns 400 for negative base_gold_reward", async () => {
        const res = await createHandler(
            makeEvent({ body: { ...validBody, base_gold_reward: -5 } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_BASE_GOLD_REWARD");
    });

    it("returns 400 for invalid type", async () => {
        const res = await createHandler(
            makeEvent({ body: { ...validBody, type: "INVALID" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_TYPE");
    });

    it("returns 400 for invalid difficulty", async () => {
        const res = await createHandler(
            makeEvent({ body: { ...validBody, difficulty: "NIGHTMARE" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_DIFFICULTY");
    });

    it("returns 409 on ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockCreateTemplate.mockRejectedValue(err);

        const res = await createHandler(makeEvent({ body: validBody }));

        expect(res.statusCode).toBe(409);
        expect(parseBody(res).error).toBe("TEMPLATE_ALREADY_EXISTS");
    });

    it("throws on unexpected repo error", async () => {
        mockCreateTemplate.mockRejectedValue(new Error("boom"));

        await expect(createHandler(makeEvent({ body: validBody }))).rejects.toThrow("boom");
    });

    it("applies defaults for optional fields", async () => {
        mockCreateTemplate.mockResolvedValue(undefined);

        await createHandler(
            makeEvent({ body: { owner_teacher_id: "t-1", title: "Minimal" } })
        );

        const item = mockCreateTemplate.mock.calls[0][0];
        expect(item.description).toBe("");
        expect(item.base_xp_reward).toBe(0);
        expect(item.base_gold_reward).toBe(0);
        expect(item.type).toBe("QUEST");
        expect(item.grade).toBe(5);
        expect(item.difficulty).toBe("MEDIUM");
        expect(item.visibility_pk).toBe("PRIVATE");
    });
});

/* ================================================================== */
/*  get handler                                                        */
/* ================================================================== */
describe("get handler", () => {
    it("returns 200 with template when found", async () => {
        const template = makeTemplate();
        mockGetTemplate.mockResolvedValue(template);

        const res = await getHandler(
            makeEvent({ pathParameters: { quest_template_id: "qt-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res)).toEqual(template);
    });

    it("returns 404 when not found", async () => {
        mockGetTemplate.mockResolvedValue(null);

        const res = await getHandler(
            makeEvent({ pathParameters: { quest_template_id: "missing" } })
        );

        expect(res.statusCode).toBe(404);
        expect(parseBody(res).error).toBe("QUEST_TEMPLATE_NOT_FOUND");
    });

    it("returns 400 when quest_template_id is missing", async () => {
        const res = await getHandler(makeEvent());

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_QUEST_TEMPLATE_ID");
    });

    it("throws on repo error", async () => {
        mockGetTemplate.mockRejectedValue(new Error("boom"));

        await expect(
            getHandler(makeEvent({ pathParameters: { quest_template_id: "qt-1" } }))
        ).rejects.toThrow("boom");
    });
});

/* ================================================================== */
/*  update handler                                                     */
/* ================================================================== */
describe("update handler", () => {
    it("returns 200 on success", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplate());
        mockUpdateTemplate.mockResolvedValue(undefined);

        const res = await updateHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { title: "Updated Title" },
            })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).message).toContain("updated");
        expect(mockUpdateTemplate).toHaveBeenCalledOnce();
    });

    it("forwards updated fields to repo", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplate());
        mockUpdateTemplate.mockResolvedValue(undefined);

        await updateHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { title: "New", base_xp_reward: 200 },
            })
        );

        const [id, updates] = mockUpdateTemplate.mock.calls[0];
        expect(id).toBe("qt-1");
        expect(updates.title).toBe("New");
        expect(updates.base_xp_reward).toBe(200);
    });

    it("recalculates visibility_pk and public_sort", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplate({ is_shared_publicly: false }));
        mockUpdateTemplate.mockResolvedValue(undefined);

        await updateHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { is_shared_publicly: true },
            })
        );

        const [, updates] = mockUpdateTemplate.mock.calls[0];
        expect(updates.visibility_pk).toBe("PUBLIC");
    });

    it("returns 400 when quest_template_id is missing", async () => {
        const res = await updateHandler(makeEvent({ body: { title: "X" } }));

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_QUEST_TEMPLATE_ID");
    });

    it("returns 400 for empty title", async () => {
        const res = await updateHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { title: "" },
            })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_TITLE");
    });

    it("returns 400 for negative base_xp_reward", async () => {
        const res = await updateHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { base_xp_reward: -1 },
            })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_BASE_XP_REWARD");
    });

    it("returns 400 for negative base_gold_reward", async () => {
        const res = await updateHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { base_gold_reward: -1 },
            })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_BASE_GOLD_REWARD");
    });

    it("returns 400 for invalid type", async () => {
        const res = await updateHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { type: "INVALID" },
            })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_TYPE");
    });

    it("returns 400 for invalid difficulty", async () => {
        const res = await updateHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { difficulty: "EXTREME" },
            })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_DIFFICULTY");
    });

    it("returns 404 when template not found (getTemplate)", async () => {
        mockGetTemplate.mockResolvedValue(null);

        const res = await updateHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { title: "X" },
            })
        );

        expect(res.statusCode).toBe(404);
        expect(parseBody(res).error).toBe("QUEST_TEMPLATE_NOT_FOUND");
    });

    it("returns 404 on ConditionalCheckFailedException from updateTemplate", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplate());
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockUpdateTemplate.mockRejectedValue(err);

        const res = await updateHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { title: "X" },
            })
        );

        expect(res.statusCode).toBe(404);
    });

    it("throws on unexpected repo error from getTemplate", async () => {
        mockGetTemplate.mockRejectedValue(new Error("boom"));

        await expect(
            updateHandler(
                makeEvent({
                    pathParameters: { quest_template_id: "qt-1" },
                    body: { title: "X" },
                })
            )
        ).rejects.toThrow("boom");
    });

    it("throws on unexpected repo error from updateTemplate", async () => {
        mockGetTemplate.mockResolvedValue(makeTemplate());
        mockUpdateTemplate.mockRejectedValue(new Error("boom"));

        await expect(
            updateHandler(
                makeEvent({
                    pathParameters: { quest_template_id: "qt-1" },
                    body: { title: "X" },
                })
            )
        ).rejects.toThrow("boom");
    });
});

/* ================================================================== */
/*  soft-delete handler                                                */
/* ================================================================== */
describe("soft-delete handler", () => {
    it("returns 200 on success", async () => {
        const deleted = makeTemplate({ is_deleted: true });
        mockSoftDeleteTemplate.mockResolvedValue(deleted);

        const res = await softDeleteHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { deleted_by_teacher_id: "teacher-1" },
            })
        );

        expect(res.statusCode).toBe(200);
        const body = parseBody(res);
        expect(body.ok).toBe(true);
        expect(body.template).toEqual(deleted);
    });

    it("passes correct args to repo", async () => {
        mockSoftDeleteTemplate.mockResolvedValue(makeTemplate());

        await softDeleteHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { deleted_by_teacher_id: "  teacher-1  " },
            })
        );

        expect(mockSoftDeleteTemplate).toHaveBeenCalledWith("qt-1", "teacher-1");
    });

    it("returns 400 when quest_template_id is missing", async () => {
        const res = await softDeleteHandler(
            makeEvent({ body: { deleted_by_teacher_id: "teacher-1" } })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toContain("quest_template_id");
    });

    it("returns 400 when deleted_by_teacher_id is missing", async () => {
        const res = await softDeleteHandler(
            makeEvent({ pathParameters: { quest_template_id: "qt-1" } })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toContain("deleted_by_teacher_id");
    });

    it("returns 400 when deleted_by_teacher_id is empty string", async () => {
        const res = await softDeleteHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { deleted_by_teacher_id: "  " },
            })
        );

        expect(res.statusCode).toBe(400);
    });

    it("returns 404 on ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSoftDeleteTemplate.mockRejectedValue(err);

        const res = await softDeleteHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { deleted_by_teacher_id: "teacher-1" },
            })
        );

        expect(res.statusCode).toBe(404);
    });

    it("returns 500 on unexpected repo error", async () => {
        mockSoftDeleteTemplate.mockRejectedValue(new Error("boom"));

        const res = await softDeleteHandler(
            makeEvent({
                pathParameters: { quest_template_id: "qt-1" },
                body: { deleted_by_teacher_id: "teacher-1" },
            })
        );

        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  list-by-owner handler                                              */
/* ================================================================== */
describe("list-by-owner handler", () => {
    it("returns 200 with items", async () => {
        const items = [makeTemplate()];
        mockListByOwner.mockResolvedValue(items);

        const res = await listByOwnerHandler(
            makeEvent({ pathParameters: { teacher_id: "teacher-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual(items);
    });

    it("forwards teacher_id to repo", async () => {
        mockListByOwner.mockResolvedValue([]);

        await listByOwnerHandler(
            makeEvent({ pathParameters: { teacher_id: "teacher-99" } })
        );

        expect(mockListByOwner).toHaveBeenCalledWith("teacher-99");
    });

    it("returns 200 with empty array when no templates", async () => {
        mockListByOwner.mockResolvedValue([]);

        const res = await listByOwnerHandler(
            makeEvent({ pathParameters: { teacher_id: "teacher-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual([]);
    });

    it("returns 400 when teacher_id is missing", async () => {
        const res = await listByOwnerHandler(makeEvent());

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_TEACHER_ID");
    });

    it("throws on repo error", async () => {
        mockListByOwner.mockRejectedValue(new Error("boom"));

        await expect(
            listByOwnerHandler(
                makeEvent({ pathParameters: { teacher_id: "teacher-1" } })
            )
        ).rejects.toThrow("boom");
    });
});

/* ================================================================== */
/*  list-public handler                                                */
/* ================================================================== */
describe("list-public handler", () => {
    it("returns 200 with items", async () => {
        const items = [makeTemplate()];
        mockListPublic.mockResolvedValue(items);

        const res = await listPublicHandler(makeEvent());

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual(items);
    });

    it("forwards query parameters to repo", async () => {
        mockListPublic.mockResolvedValue([]);

        await listPublicHandler(
            makeEvent({
                queryStringParameters: {
                    subject: "Mathematics",
                    grade: "6",
                    difficulty: "HARD",
                    limit: "25",
                },
            })
        );

        expect(mockListPublic).toHaveBeenCalledWith({
            subject: "Mathematics",
            grade: 6,
            difficulty: "HARD",
            limit: 25,
        });
    });

    it("returns 200 with empty array when no templates", async () => {
        mockListPublic.mockResolvedValue([]);

        const res = await listPublicHandler(makeEvent());

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual([]);
    });

    it("returns 400 for invalid grade", async () => {
        const res = await listPublicHandler(
            makeEvent({ queryStringParameters: { grade: "abc" } })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_GRADE");
    });

    it("returns 400 for grade < 1", async () => {
        const res = await listPublicHandler(
            makeEvent({ queryStringParameters: { grade: "0" } })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_GRADE");
    });

    it("returns 400 for invalid limit", async () => {
        const res = await listPublicHandler(
            makeEvent({ queryStringParameters: { limit: "abc" } })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_LIMIT");
    });

    it("returns 400 for limit > 1000", async () => {
        const res = await listPublicHandler(
            makeEvent({ queryStringParameters: { limit: "1001" } })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_LIMIT");
    });

    it("returns 400 for limit < 1", async () => {
        const res = await listPublicHandler(
            makeEvent({ queryStringParameters: { limit: "0" } })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_LIMIT");
    });

    it("throws on repo error", async () => {
        mockListPublic.mockRejectedValue(new Error("boom"));

        await expect(listPublicHandler(makeEvent())).rejects.toThrow("boom");
    });
});

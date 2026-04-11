import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Repo mock                                                          */
/* ------------------------------------------------------------------ */
const mockPutTeacherProfile    = vi.fn();
const mockGetTeacherProfile    = vi.fn();
const mockListTeachersBySchool = vi.fn();

const repoExports = {
    putTeacherProfile:    (...args: any[]) => mockPutTeacherProfile(...args),
    getTeacherProfile:    (...args: any[]) => mockGetTeacherProfile(...args),
    listTeachersBySchool: (...args: any[]) => mockListTeachersBySchool(...args),
};

vi.mock("../repo",    () => repoExports);
vi.mock("../repo.ts", () => repoExports);
vi.mock("../repo.js", () => repoExports);

/* ------------------------------------------------------------------ */
/*  Handler imports (dynamic)                                          */
/* ------------------------------------------------------------------ */
let createHandler:      (typeof import("../create.ts"))["handler"];
let getHandler:         (typeof import("../get.ts"))["handler"];
let listBySchoolHandler:(typeof import("../list-by-school.ts"))["handler"];
let createTeacherProfileHandler: (typeof import("../handlers.ts"))["createTeacherProfileHandler"];

beforeAll(async () => {
    createHandler      = (await import("../create.ts")).handler;
    getHandler         = (await import("../get.ts")).handler;
    listBySchoolHandler = (await import("../list-by-school.ts")).handler;
    createTeacherProfileHandler = (await import("../handlers.ts")).createTeacherProfileHandler;
});

beforeEach(() => {
    mockPutTeacherProfile.mockReset();
    mockGetTeacherProfile.mockReset();
    mockListTeachersBySchool.mockReset();
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function makeEvent(overrides: {
    body?: object | string;
    pathParameters?: Record<string, string>;
} = {}) {
    return {
        body: overrides.body
            ? typeof overrides.body === "string"
                ? overrides.body
                : JSON.stringify(overrides.body)
            : undefined,
        pathParameters: overrides.pathParameters,
    };
}

function parseBody(res: any) {
    return JSON.parse(res.body);
}

function makeProfile(overrides: Record<string, any> = {}) {
    return {
        teacher_id: "teacher-1",
        school_id: "school-1",
        display_name: "Ms. Smith",
        email: "smith@example.com",
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
        teacher_id: "teacher-1",
        school_id: "school-1",
        display_name: "Ms. Smith",
        email: "smith@example.com",
    };

    it("returns 201 on success", async () => {
        mockPutTeacherProfile.mockResolvedValue(undefined);

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(201);
        expect(parseBody(res).ok).toBe(true);
        expect(parseBody(res).teacher_id).toBe("teacher-1");
    });

    it("forwards all fields to repo", async () => {
        mockPutTeacherProfile.mockResolvedValue(undefined);

        await createHandler(makeEvent({ body: validBody }));

        const item = mockPutTeacherProfile.mock.calls[0][0];
        expect(item.teacher_id).toBe("teacher-1");
        expect(item.school_id).toBe("school-1");
        expect(item.display_name).toBe("Ms. Smith");
        expect(item.email).toBe("smith@example.com");
        expect(item.created_at).toBeDefined();
        expect(item.updated_at).toBeDefined();
    });

    it("returns 400 when teacher_id is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { display_name: "X", email: "x@x.com" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_REQUIRED_FIELDS");
    });

    it("returns 400 when display_name is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { teacher_id: "t-1", email: "x@x.com" } })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when email is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { teacher_id: "t-1", display_name: "X" } })
        );
        expect(res.statusCode).toBe(400);
    });

    it("allows school_id to be omitted (defaults to null)", async () => {
        mockPutTeacherProfile.mockResolvedValue(undefined);

        await createHandler(
            makeEvent({ body: { teacher_id: "t-1", display_name: "X", email: "x@x.com" } })
        );

        const item = mockPutTeacherProfile.mock.calls[0][0];
        expect(item.school_id).toBeNull();
    });

    it("throws on repo error", async () => {
        mockPutTeacherProfile.mockRejectedValue(new Error("boom"));
        await expect(createHandler(makeEvent({ body: validBody }))).rejects.toThrow("boom");
    });
});

/* ================================================================== */
/*  get handler                                                        */
/* ================================================================== */
describe("get handler", () => {
    it("returns 200 with profile when found", async () => {
        const profile = makeProfile();
        mockGetTeacherProfile.mockResolvedValue(profile);

        const res = await getHandler(
            makeEvent({ pathParameters: { teacher_id: "teacher-1" } })
        );
        expect(res.statusCode).toBe(200);
        expect(parseBody(res)).toEqual(profile);
    });

    it("returns 404 when not found", async () => {
        mockGetTeacherProfile.mockResolvedValue(null);

        const res = await getHandler(
            makeEvent({ pathParameters: { teacher_id: "missing" } })
        );
        expect(res.statusCode).toBe(404);
        expect(parseBody(res).error).toBe("NOT_FOUND");
    });

    it("throws on repo error", async () => {
        mockGetTeacherProfile.mockRejectedValue(new Error("boom"));
        await expect(
            getHandler(makeEvent({ pathParameters: { teacher_id: "teacher-1" } }))
        ).rejects.toThrow("boom");
    });
});

/* ================================================================== */
/*  list-by-school handler                                             */
/* ================================================================== */
describe("list-by-school handler", () => {
    it("returns 200 with items", async () => {
        const items = [makeProfile()];
        mockListTeachersBySchool.mockResolvedValue(items);

        const res = await listBySchoolHandler(
            makeEvent({ pathParameters: { school_id: "school-1" } })
        );
        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual(items);
    });

    it("returns 200 with empty array", async () => {
        mockListTeachersBySchool.mockResolvedValue([]);

        const res = await listBySchoolHandler(
            makeEvent({ pathParameters: { school_id: "school-1" } })
        );
        expect(parseBody(res).items).toEqual([]);
    });

    it("throws on repo error", async () => {
        mockListTeachersBySchool.mockRejectedValue(new Error("boom"));
        await expect(
            listBySchoolHandler(makeEvent({ pathParameters: { school_id: "school-1" } }))
        ).rejects.toThrow("boom");
    });
});

/* ================================================================== */
/*  handlers.ts — createTeacherProfileHandler                          */
/* ================================================================== */
describe("createTeacherProfileHandler", () => {
    it("calls putTeacherProfile and returns ok", async () => {
        mockPutTeacherProfile.mockResolvedValue(undefined);

        const result = await createTeacherProfileHandler({
            teacher_id: "teacher-1",
            school_id: "school-1",
            display_name: "Ms. Smith",
            email: "smith@example.com",
        });

        expect(result).toEqual({ ok: true, teacher_id: "teacher-1" });
        expect(mockPutTeacherProfile).toHaveBeenCalledOnce();
    });

    it("propagates repo errors", async () => {
        mockPutTeacherProfile.mockRejectedValue(new Error("boom"));
        await expect(
            createTeacherProfileHandler({ teacher_id: "t-1" })
        ).rejects.toThrow("boom");
    });
});

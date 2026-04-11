import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Repo mock                                                          */
/* ------------------------------------------------------------------ */
const mockPutSchool   = vi.fn();
const mockGetSchool   = vi.fn();
const mockListSchools = vi.fn();

const repoExports = {
    putSchool:   (...args: any[]) => mockPutSchool(...args),
    getSchool:   (...args: any[]) => mockGetSchool(...args),
    listSchools: (...args: any[]) => mockListSchools(...args),
};

// create.ts and get.ts import from "./repo" (no extension); list.ts imports from "./repo.ts"
vi.mock("../repo",    () => repoExports);
vi.mock("../repo.ts", () => repoExports);
vi.mock("../repo.js", () => repoExports);

/* ------------------------------------------------------------------ */
/*  Handler imports (dynamic)                                          */
/* ------------------------------------------------------------------ */
let createHandler: (typeof import("../create.ts"))["handler"];
let getHandler:    (typeof import("../get.ts"))["handler"];
let listHandler:   (typeof import("../list.ts"))["handler"];

beforeAll(async () => {
    createHandler = (await import("../create.ts")).handler;
    getHandler    = (await import("../get.ts")).handler;
    listHandler   = (await import("../list.ts")).handler;
});

beforeEach(() => {
    mockPutSchool.mockReset();
    mockGetSchool.mockReset();
    mockListSchools.mockReset();
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

function makeSchool(overrides: Record<string, any> = {}) {
    return {
        school_id: "sch-1",
        name: "Maple Elementary",
        division: "Division A",
        city: "Vancouver",
        province: "BC",
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
        school_id: "sch-1",
        name: "Maple Elementary",
        division: "Division A",
        city: "Vancouver",
        province: "BC",
    };

    it("returns 201 on success", async () => {
        mockPutSchool.mockResolvedValue(undefined);

        const res = await createHandler(makeEvent({ body: validBody }));

        expect(res.statusCode).toBe(201);
        const body = parseBody(res);
        expect(body.ok).toBe(true);
        expect(body.school_id).toBe("sch-1");
        expect(mockPutSchool).toHaveBeenCalledOnce();
    });

    it("forwards all fields to repo", async () => {
        mockPutSchool.mockResolvedValue(undefined);

        await createHandler(makeEvent({ body: validBody }));

        const item = mockPutSchool.mock.calls[0][0];
        expect(item.school_id).toBe("sch-1");
        expect(item.name).toBe("Maple Elementary");
        expect(item.division).toBe("Division A");
        expect(item.city).toBe("Vancouver");
        expect(item.province).toBe("BC");
        expect(item.created_at).toBeDefined();
        expect(item.updated_at).toBeDefined();
    });

    it("returns 400 when school_id is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { name: "X", division: "D", city: "C", province: "P" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_REQUIRED_FIELDS");
    });

    it("returns 400 when name is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { school_id: "s-1", division: "D", city: "C", province: "P" } })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when division is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { school_id: "s-1", name: "N", city: "C", province: "P" } })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when city is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { school_id: "s-1", name: "N", division: "D", province: "P" } })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when province is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { school_id: "s-1", name: "N", division: "D", city: "C" } })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 409 on ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockPutSchool.mockRejectedValue(err);

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(409);
        expect(parseBody(res).error).toBe("SCHOOL_ALREADY_EXISTS");
    });

    it("throws on unexpected repo error", async () => {
        mockPutSchool.mockRejectedValue(new Error("boom"));

        await expect(createHandler(makeEvent({ body: validBody }))).rejects.toThrow("boom");
    });
});

/* ================================================================== */
/*  get handler                                                        */
/* ================================================================== */
describe("get handler", () => {
    it("returns 200 with school when found", async () => {
        const school = makeSchool();
        mockGetSchool.mockResolvedValue(school);

        const res = await getHandler(
            makeEvent({ pathParameters: { school_id: "sch-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res)).toEqual(school);
    });

    it("returns 404 when not found", async () => {
        mockGetSchool.mockResolvedValue(null);

        const res = await getHandler(
            makeEvent({ pathParameters: { school_id: "missing" } })
        );

        expect(res.statusCode).toBe(404);
        expect(parseBody(res).error).toBe("NOT_FOUND");
    });

    it("throws on repo error", async () => {
        mockGetSchool.mockRejectedValue(new Error("boom"));

        await expect(
            getHandler(makeEvent({ pathParameters: { school_id: "sch-1" } }))
        ).rejects.toThrow("boom");
    });
});

/* ================================================================== */
/*  list handler                                                       */
/* ================================================================== */
describe("list handler", () => {
    it("returns 200 with items", async () => {
        const items = [makeSchool(), makeSchool({ school_id: "sch-2" })];
        mockListSchools.mockResolvedValue(items);

        const res = await listHandler(makeEvent());

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual(items);
    });

    it("returns 200 with empty array when no schools", async () => {
        mockListSchools.mockResolvedValue([]);

        const res = await listHandler(makeEvent());

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual([]);
    });

    it("throws on repo error", async () => {
        mockListSchools.mockRejectedValue(new Error("boom"));

        await expect(listHandler(makeEvent())).rejects.toThrow("boom");
    });
});

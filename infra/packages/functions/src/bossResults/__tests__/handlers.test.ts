import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Repo mock                                                          */
/* ------------------------------------------------------------------ */
const mockComputeAndWriteBossResults = vi.fn();
const mockGetBossResults             = vi.fn();
const mockListStudentBossResults     = vi.fn();

const repoExports = {
    computeAndWriteBossResults: (...args: any[]) => mockComputeAndWriteBossResults(...args),
    getBossResults:             (...args: any[]) => mockGetBossResults(...args),
    listStudentBossResults:     (...args: any[]) => mockListStudentBossResults(...args),
    resultsExist:               vi.fn(),
};

vi.mock("../repo.ts", () => repoExports);
vi.mock("../repo.js", () => repoExports);

/* ------------------------------------------------------------------ */
/*  Handler imports (dynamic)                                          */
/* ------------------------------------------------------------------ */
let computeHandler:      (typeof import("../compute.ts"))["handler"];
let getResultsHandler:   (typeof import("../get-results.ts"))["handler"];
let listByStudentHandler:(typeof import("../list-by-student.ts"))["handler"];

beforeAll(async () => {
    computeHandler      = (await import("../compute.ts")).handler;
    getResultsHandler   = (await import("../get-results.ts")).handler;
    listByStudentHandler = (await import("../list-by-student.ts")).handler;
});

beforeEach(() => {
    mockComputeAndWriteBossResults.mockReset();
    mockGetBossResults.mockReset();
    mockListStudentBossResults.mockReset();
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

/* ================================================================== */
/*  compute handler                                                    */
/* ================================================================== */
describe("compute handler", () => {
    it("returns 200 when computation succeeds", async () => {
        mockComputeAndWriteBossResults.mockResolvedValue({
            success: true,
            message: "Boss results computed and written successfully",
        });

        const res = await computeHandler(
            makeEvent({ pathParameters: { boss_instance_id: "battle-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).success).toBe(true);
        expect(mockComputeAndWriteBossResults).toHaveBeenCalledWith("battle-1", "manual-trigger");
    });

    it("returns 400 when boss_instance_id is missing", async () => {
        const res = await computeHandler(makeEvent());
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when results already exist", async () => {
        mockComputeAndWriteBossResults.mockResolvedValue({
            success: false,
            message: "Results already exist for this battle",
        });

        const res = await computeHandler(
            makeEvent({ pathParameters: { boss_instance_id: "battle-1" } })
        );

        expect(res.statusCode).toBe(400);
        expect(parseBody(res).success).toBe(false);
    });

    it("returns 500 on unexpected error", async () => {
        mockComputeAndWriteBossResults.mockRejectedValue(new Error("boom"));

        const res = await computeHandler(
            makeEvent({ pathParameters: { boss_instance_id: "battle-1" } })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  get-results handler                                                */
/* ================================================================== */
describe("get-results handler", () => {
    it("returns 200 with results", async () => {
        const results = {
            outcome: "WIN",
            completed_at: "2026-01-01T00:00:00.000Z",
            guild_results: [{ guild_id: "g-1" }],
            student_results: [{ student_id: "s-1" }],
        };
        mockGetBossResults.mockResolvedValue(results);

        const res = await getResultsHandler(
            makeEvent({ pathParameters: { boss_instance_id: "battle-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res)).toEqual(results);
    });

    it("returns 400 when boss_instance_id is missing", async () => {
        const res = await getResultsHandler(makeEvent());
        expect(res.statusCode).toBe(400);
    });

    it("returns 500 on repo error", async () => {
        mockGetBossResults.mockRejectedValue(new Error("boom"));

        const res = await getResultsHandler(
            makeEvent({ pathParameters: { boss_instance_id: "battle-1" } })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  list-by-student handler                                            */
/* ================================================================== */
describe("list-by-student handler", () => {
    it("returns 200 with items", async () => {
        const result = { items: [{ student_id: "s-1" }], nextToken: undefined };
        mockListStudentBossResults.mockResolvedValue(result);

        const res = await listByStudentHandler(
            makeEvent({ pathParameters: { student_id: "s-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toHaveLength(1);
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await listByStudentHandler(makeEvent());
        expect(res.statusCode).toBe(400);
    });

    it("forwards limit and cursor to repo", async () => {
        mockListStudentBossResults.mockResolvedValue({ items: [], nextToken: undefined });

        await listByStudentHandler(
            makeEvent({
                pathParameters: { student_id: "s-1" },
                queryStringParameters: { limit: "10", cursor: "abc" },
            })
        );

        expect(mockListStudentBossResults).toHaveBeenCalledWith("s-1", {
            limit: 10,
            nextToken: "abc",
        });
    });

    it("returns 200 with empty items", async () => {
        mockListStudentBossResults.mockResolvedValue({ items: [], nextToken: undefined });

        const res = await listByStudentHandler(
            makeEvent({ pathParameters: { student_id: "s-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual([]);
    });

    it("returns 500 on repo error", async () => {
        mockListStudentBossResults.mockRejectedValue(new Error("boom"));

        const res = await listByStudentHandler(
            makeEvent({ pathParameters: { student_id: "s-1" } })
        );
        expect(res.statusCode).toBe(500);
    });
});

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Repo mock                                                          */
/* ------------------------------------------------------------------ */
const mockPutTransaction          = vi.fn();
const mockGetTransaction          = vi.fn();
const mockListByStudent           = vi.fn();
const mockListByStudentAndClass   = vi.fn();
const mockListBySource            = vi.fn();

const repoExports = {
    putTransaction:        (...args: any[]) => mockPutTransaction(...args),
    getTransaction:        (...args: any[]) => mockGetTransaction(...args),
    listByStudent:         (...args: any[]) => mockListByStudent(...args),
    listByStudentAndClass: (...args: any[]) => mockListByStudentAndClass(...args),
    listBySource:          (...args: any[]) => mockListBySource(...args),
};

vi.mock("../repo.ts", () => repoExports);
vi.mock("../repo.js", () => repoExports);

/* ------------------------------------------------------------------ */
/*  Auth mock                                                          */
/* ------------------------------------------------------------------ */
const mockGetAuthContext = vi.fn();

vi.mock("../../shared/auth.js", () => ({
    getAuthContext: (...args: any[]) => mockGetAuthContext(...args),
}));
vi.mock("../../shared/auth.ts", () => ({
    getAuthContext: (...args: any[]) => mockGetAuthContext(...args),
}));

/* ------------------------------------------------------------------ */
/*  Handler imports (dynamic)                                          */
/* ------------------------------------------------------------------ */
let createHandler:             (typeof import("../create-transaction.ts"))["handler"];
let getHandler:                (typeof import("../get-transaction.ts"))["handler"];
let listBySourceHandler:       (typeof import("../list-by-source.ts"))["handler"];
let listByStudentAndClassHandler: (typeof import("../list-by-student-and-class.ts"))["handler"];
let listByStudentHandler:      (typeof import("../list-by-student.ts"))["handler"];

beforeAll(async () => {
    createHandler                = (await import("../create-transaction.ts")).handler;
    getHandler                   = (await import("../get-transaction.ts")).handler;
    listBySourceHandler          = (await import("../list-by-source.ts")).handler;
    listByStudentAndClassHandler = (await import("../list-by-student-and-class.ts")).handler;
    listByStudentHandler         = (await import("../list-by-student.ts")).handler;
});

beforeEach(() => {
    mockPutTransaction.mockReset();
    mockGetTransaction.mockReset();
    mockListByStudent.mockReset();
    mockListByStudentAndClass.mockReset();
    mockListBySource.mockReset();
    mockGetAuthContext.mockReset();

    // Default: teacher auth
    mockGetAuthContext.mockResolvedValue({ sub: "teacher-1", role: "teacher" });
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

function makeTxn(overrides: Record<string, any> = {}) {
    return {
        transaction_id: "tx-1",
        student_id: "stu-1",
        class_id: "class-1",
        xp_delta: 10,
        gold_delta: 5,
        hearts_delta: 0,
        source_type: "MANUAL_ADJUSTMENT",
        created_at: "2026-01-01T00:00:00.000Z",
        created_by: "teacher-1",
        created_by_role: "TEACHER",
        ...overrides,
    };
}

/* ================================================================== */
/*  create-transaction handler                                         */
/* ================================================================== */
describe("create-transaction handler", () => {
    const validBody = {
        student_id: "stu-1",
        class_id: "class-1",
        xp_delta: 10,
        gold_delta: 0,
        hearts_delta: 0,
        source_type: "MANUAL_ADJUSTMENT",
        reason: "Bonus points",
    };

    it("returns 201 on success", async () => {
        mockPutTransaction.mockResolvedValue(undefined);

        const res = await createHandler(makeEvent({ body: validBody }));

        expect(res.statusCode).toBe(201);
        const body = parseBody(res);
        expect(body.transaction_id).toBeDefined();
        expect(body.message).toContain("created");
        expect(mockPutTransaction).toHaveBeenCalledOnce();
    });

    it("returns 401 when auth fails", async () => {
        const authErr: any = new Error("Unauthorized");
        authErr.statusCode = 401;
        mockGetAuthContext.mockRejectedValue(authErr);

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(401);
    });

    it("returns 403 when student attempts to create", async () => {
        mockGetAuthContext.mockResolvedValue({ sub: "stu-1", role: "student" });

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(403);
    });

    it("returns 400 for NaN deltas", async () => {
        const res = await createHandler(
            makeEvent({ body: { ...validBody, xp_delta: "abc" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toContain("valid numbers");
    });

    it("returns 400 when all deltas are zero", async () => {
        const res = await createHandler(
            makeEvent({
                body: { ...validBody, xp_delta: 0, gold_delta: 0, hearts_delta: 0 },
            })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when student_id is missing", async () => {
        const body = { ...validBody };
        delete (body as any).student_id;

        const res = await createHandler(makeEvent({ body }));
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid source_type", async () => {
        const res = await createHandler(
            makeEvent({ body: { ...validBody, source_type: "NOPE" } })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 409 on ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockPutTransaction.mockRejectedValue(err);

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(409);
        expect(parseBody(res).error).toContain("idempotent");
    });

    it("returns 500 on unexpected repo error", async () => {
        mockPutTransaction.mockRejectedValue(new Error("boom"));

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(500);
    });

    it("uses client-provided transaction_id when given", async () => {
        mockPutTransaction.mockResolvedValue(undefined);

        const res = await createHandler(
            makeEvent({ body: { ...validBody, transaction_id: "my-custom-id" } })
        );

        expect(res.statusCode).toBe(201);
        expect(parseBody(res).transaction_id).toBe("my-custom-id");
    });

    it("generates deterministic ID for QUEST_QUESTION", async () => {
        mockPutTransaction.mockResolvedValue(undefined);

        const res = await createHandler(
            makeEvent({
                body: {
                    student_id: "stu-1",
                    xp_delta: 10,
                    gold_delta: 0,
                    hearts_delta: 0,
                    source_type: "QUEST_QUESTION",
                    quest_instance_id: "qi-1",
                    question_id: "q-1",
                },
            })
        );

        expect(res.statusCode).toBe(201);
        expect(parseBody(res).transaction_id).toBe("QUESTQ#qi-1#stu-1#q-1");
    });

    it("generates deterministic ID for BOSS_BATTLE", async () => {
        mockPutTransaction.mockResolvedValue(undefined);

        const res = await createHandler(
            makeEvent({
                body: {
                    student_id: "stu-1",
                    xp_delta: 5,
                    gold_delta: 0,
                    hearts_delta: 0,
                    source_type: "BOSS_BATTLE",
                    boss_battle_instance_id: "bb-1",
                },
            })
        );

        expect(res.statusCode).toBe(201);
        expect(parseBody(res).transaction_id).toBe("BOSS#bb-1#stu-1");
    });
});

/* ================================================================== */
/*  get-transaction handler                                            */
/* ================================================================== */
describe("get-transaction handler", () => {
    it("returns 200 with transaction", async () => {
        const txn = makeTxn();
        mockGetTransaction.mockResolvedValue(txn);

        const res = await getHandler(
            makeEvent({ pathParameters: { transaction_id: "tx-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res)).toEqual(txn);
    });

    it("returns 400 when transaction_id is missing", async () => {
        const res = await getHandler(makeEvent());
        expect(res.statusCode).toBe(400);
    });

    it("returns 401 when auth fails", async () => {
        const authErr: any = new Error("Unauthorized");
        authErr.statusCode = 401;
        mockGetAuthContext.mockRejectedValue(authErr);

        const res = await getHandler(
            makeEvent({ pathParameters: { transaction_id: "tx-1" } })
        );
        expect(res.statusCode).toBe(401);
    });

    it("returns 404 when not found", async () => {
        mockGetTransaction.mockResolvedValue(null);

        const res = await getHandler(
            makeEvent({ pathParameters: { transaction_id: "missing" } })
        );
        expect(res.statusCode).toBe(404);
    });

    it("returns 200 when student views own transaction", async () => {
        mockGetAuthContext.mockResolvedValue({ sub: "stu-1", role: "student" });
        mockGetTransaction.mockResolvedValue(makeTxn({ student_id: "stu-1" }));

        const res = await getHandler(
            makeEvent({ pathParameters: { transaction_id: "tx-1" } })
        );
        expect(res.statusCode).toBe(200);
    });

    it("returns 403 when student views another's transaction", async () => {
        mockGetAuthContext.mockResolvedValue({ sub: "stu-2", role: "student" });
        mockGetTransaction.mockResolvedValue(makeTxn({ student_id: "stu-1" }));

        const res = await getHandler(
            makeEvent({ pathParameters: { transaction_id: "tx-1" } })
        );
        expect(res.statusCode).toBe(403);
    });

    it("returns 500 on repo error", async () => {
        mockGetTransaction.mockRejectedValue(new Error("boom"));

        const res = await getHandler(
            makeEvent({ pathParameters: { transaction_id: "tx-1" } })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  list-by-source handler                                             */
/* ================================================================== */
describe("list-by-source handler", () => {
    it("returns 200 with items", async () => {
        mockListBySource.mockResolvedValue({ items: [makeTxn()], cursor: undefined });

        const res = await listBySourceHandler(
            makeEvent({
                pathParameters: { source_type: "QUEST_QUESTION", source_id: "qi-1" },
            })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toHaveLength(1);
    });

    it("returns 400 when path params missing", async () => {
        const res = await listBySourceHandler(makeEvent());
        expect(res.statusCode).toBe(400);
    });

    it("returns 401 when auth fails", async () => {
        const authErr: any = new Error("Unauthorized");
        authErr.statusCode = 401;
        mockGetAuthContext.mockRejectedValue(authErr);

        const res = await listBySourceHandler(
            makeEvent({
                pathParameters: { source_type: "QUEST_QUESTION", source_id: "qi-1" },
            })
        );
        expect(res.statusCode).toBe(401);
    });

    it("returns 403 when student attempts", async () => {
        mockGetAuthContext.mockResolvedValue({ sub: "stu-1", role: "student" });

        const res = await listBySourceHandler(
            makeEvent({
                pathParameters: { source_type: "QUEST_QUESTION", source_id: "qi-1" },
            })
        );
        expect(res.statusCode).toBe(403);
    });

    it("forwards limit and cursor to repo", async () => {
        mockListBySource.mockResolvedValue({ items: [], cursor: undefined });

        await listBySourceHandler(
            makeEvent({
                pathParameters: { source_type: "QUEST_QUESTION", source_id: "qi-1" },
                queryStringParameters: { limit: "25", cursor: "abc123" },
            })
        );

        expect(mockListBySource).toHaveBeenCalledWith("QUEST_QUESTION", "qi-1", 25, "abc123");
    });

    it("returns 200 with empty items", async () => {
        mockListBySource.mockResolvedValue({ items: [], cursor: undefined });

        const res = await listBySourceHandler(
            makeEvent({
                pathParameters: { source_type: "BOSS_BATTLE", source_id: "bb-1" },
            })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual([]);
    });

    it("returns 500 on repo error", async () => {
        mockListBySource.mockRejectedValue(new Error("boom"));

        const res = await listBySourceHandler(
            makeEvent({
                pathParameters: { source_type: "QUEST_QUESTION", source_id: "qi-1" },
            })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  list-by-student-and-class handler                                  */
/* ================================================================== */
describe("list-by-student-and-class handler", () => {
    it("returns 200 with items", async () => {
        mockListByStudentAndClass.mockResolvedValue({ items: [makeTxn()], cursor: undefined });

        const res = await listByStudentAndClassHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1", class_id: "class-1" },
            })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toHaveLength(1);
    });

    it("returns 400 when path params missing", async () => {
        const res = await listByStudentAndClassHandler(makeEvent());
        expect(res.statusCode).toBe(400);
    });

    it("returns 401 when auth fails", async () => {
        const authErr: any = new Error("Unauthorized");
        authErr.statusCode = 401;
        mockGetAuthContext.mockRejectedValue(authErr);

        const res = await listByStudentAndClassHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1", class_id: "class-1" },
            })
        );
        expect(res.statusCode).toBe(401);
    });

    it("returns 200 when student views own data", async () => {
        mockGetAuthContext.mockResolvedValue({ sub: "stu-1", role: "student" });
        mockListByStudentAndClass.mockResolvedValue({ items: [], cursor: undefined });

        const res = await listByStudentAndClassHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1", class_id: "class-1" },
            })
        );
        expect(res.statusCode).toBe(200);
    });

    it("returns 403 when student views another's data", async () => {
        mockGetAuthContext.mockResolvedValue({ sub: "stu-2", role: "student" });

        const res = await listByStudentAndClassHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1", class_id: "class-1" },
            })
        );
        expect(res.statusCode).toBe(403);
    });

    it("forwards limit and cursor to repo", async () => {
        mockListByStudentAndClass.mockResolvedValue({ items: [], cursor: undefined });

        await listByStudentAndClassHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1", class_id: "class-1" },
                queryStringParameters: { limit: "10", cursor: "tok" },
            })
        );

        expect(mockListByStudentAndClass).toHaveBeenCalledWith("stu-1", "class-1", 10, "tok");
    });

    it("returns 500 on repo error", async () => {
        mockListByStudentAndClass.mockRejectedValue(new Error("boom"));

        const res = await listByStudentAndClassHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1", class_id: "class-1" },
            })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  list-by-student handler                                            */
/* ================================================================== */
describe("list-by-student handler", () => {
    it("returns 200 with items", async () => {
        mockListByStudent.mockResolvedValue({ items: [makeTxn()], cursor: undefined });

        const res = await listByStudentHandler(
            makeEvent({ pathParameters: { student_id: "stu-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toHaveLength(1);
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await listByStudentHandler(makeEvent());
        expect(res.statusCode).toBe(400);
    });

    it("returns 401 when auth fails", async () => {
        const authErr: any = new Error("Unauthorized");
        authErr.statusCode = 401;
        mockGetAuthContext.mockRejectedValue(authErr);

        const res = await listByStudentHandler(
            makeEvent({ pathParameters: { student_id: "stu-1" } })
        );
        expect(res.statusCode).toBe(401);
    });

    it("returns 200 when student views own data", async () => {
        mockGetAuthContext.mockResolvedValue({ sub: "stu-1", role: "student" });
        mockListByStudent.mockResolvedValue({ items: [], cursor: undefined });

        const res = await listByStudentHandler(
            makeEvent({ pathParameters: { student_id: "stu-1" } })
        );
        expect(res.statusCode).toBe(200);
    });

    it("returns 403 when student views another's data", async () => {
        mockGetAuthContext.mockResolvedValue({ sub: "stu-2", role: "student" });

        const res = await listByStudentHandler(
            makeEvent({ pathParameters: { student_id: "stu-1" } })
        );
        expect(res.statusCode).toBe(403);
    });

    it("forwards limit and cursor to repo", async () => {
        mockListByStudent.mockResolvedValue({ items: [], cursor: undefined });

        await listByStudentHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                queryStringParameters: { limit: "50", cursor: "cur" },
            })
        );

        expect(mockListByStudent).toHaveBeenCalledWith("stu-1", 50, "cur");
    });

    it("returns 200 with empty items", async () => {
        mockListByStudent.mockResolvedValue({ items: [], cursor: undefined });

        const res = await listByStudentHandler(
            makeEvent({ pathParameters: { student_id: "stu-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual([]);
    });

    it("returns 500 on repo error", async () => {
        mockListByStudent.mockRejectedValue(new Error("boom"));

        const res = await listByStudentHandler(
            makeEvent({ pathParameters: { student_id: "stu-1" } })
        );
        expect(res.statusCode).toBe(500);
    });
});

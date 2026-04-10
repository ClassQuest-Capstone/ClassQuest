/**
 * Unit tests for questAnswerAttempts handlers:
 *   - create-attempt.ts
 *   - grade-attempt.ts
 *   - list-by-pk.ts
 *   - list-by-gsi1.ts
 *   - list-by-gsi2.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questAnswerAttempts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock repo
// ---------------------------------------------------------------------------
const mockCreateAttemptWithCounter = vi.fn();
const mockUpdateAttemptGrade = vi.fn();
const mockQueryByPK   = vi.fn();
const mockQueryByGSI1 = vi.fn();
const mockQueryByGSI2 = vi.fn();

vi.mock("../repo.js", () => ({
    createAttemptWithCounter: (...args: any[]) => mockCreateAttemptWithCounter(...args),
    updateAttemptGrade:       (...args: any[]) => mockUpdateAttemptGrade(...args),
    queryByPK:                (...args: any[]) => mockQueryByPK(...args),
    queryByGSI1:              (...args: any[]) => mockQueryByGSI1(...args),
    queryByGSI2:              (...args: any[]) => mockQueryByGSI2(...args),
}));

// ---------------------------------------------------------------------------
// Module references
// ---------------------------------------------------------------------------
let createHandler:   (typeof import("../create-attempt.js"))["handler"];
let gradeHandler:    (typeof import("../grade-attempt.js"))["handler"];
let listPKHandler:   (typeof import("../list-by-pk.js"))["handler"];
let listGSI1Handler: (typeof import("../list-by-gsi1.js"))["handler"];
let listGSI2Handler: (typeof import("../list-by-gsi2.js"))["handler"];

beforeAll(async () => {
    process.env.QUEST_ANSWER_ATTEMPTS_TABLE_NAME = "test-quest-answer-attempts";
    createHandler   = (await import("../create-attempt.js")).handler;
    gradeHandler    = (await import("../grade-attempt.js")).handler;
    listPKHandler   = (await import("../list-by-pk.js")).handler;
    listGSI1Handler = (await import("../list-by-gsi1.js")).handler;
    listGSI2Handler = (await import("../list-by-gsi2.js")).handler;
});

beforeEach(() => {
    mockCreateAttemptWithCounter.mockReset();
    mockUpdateAttemptGrade.mockReset();
    mockQueryByPK.mockReset();
    mockQueryByGSI1.mockReset();
    mockQueryByGSI2.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAuth(userId = "user-1", groups = "Students") {
    return {
        requestContext: {
            authorizer: {
                jwt: {
                    claims: {
                        sub: userId,
                        "cognito:groups": groups,
                    },
                },
            },
        },
    };
}

function makeAttempt(overrides: Record<string, any> = {}) {
    return {
        quest_attempt_pk: "QI#qi-1#S#s-1#Q#q-1",
        attempt_sk: "A#000001#T#2024-01-01T00:00:00.000Z",
        quest_instance_id: "qi-1",
        student_id: "s-1",
        question_id: "q-1",
        attempt_no: 1,
        answer_raw: "my answer",
        created_at: "2024-01-01T00:00:00.000Z",
        gsi1_pk: "S#s-1#QI#qi-1",
        gsi1_sk: "T#2024-01-01T00:00:00.000Z#Q#q-1#A#000001",
        gsi2_pk: "QI#qi-1#Q#q-1",
        gsi2_sk: "T#2024-01-01T00:00:00.000Z#S#s-1#A#000001",
        ...overrides,
    };
}

// ===========================================================================
// create-attempt.ts
// ===========================================================================
describe("create-attempt handler", () => {
    function makeEvent(bodyOverrides: Record<string, any> = {}, authOverrides: Partial<ReturnType<typeof makeAuth>> = {}) {
        return {
            ...makeAuth("user-1", "Students"),
            ...authOverrides,
            body: JSON.stringify({
                quest_instance_id: "qi-1",
                question_id: "q-1",
                answer_raw: "my answer",
                ...bodyOverrides,
            }),
        };
    }

    describe("auth", () => {
        it("returns 401 when userId is missing", async () => {
            const res = await createHandler({
                requestContext: { authorizer: { jwt: { claims: {} } } },
                body: JSON.stringify({ quest_instance_id: "qi-1", question_id: "q-1", answer_raw: "answer" }),
            });
            expect(res.statusCode).toBe(401);
        });

        it("student uses their own userId as student_id", async () => {
            mockCreateAttemptWithCounter.mockResolvedValueOnce(makeAttempt());
            await createHandler(makeEvent());
            expect(mockCreateAttemptWithCounter).toHaveBeenCalledWith(
                "qi-1", "user-1", "q-1", "my answer", undefined, expect.any(String)
            );
        });

        it("system user can specify a different student_id in body", async () => {
            mockCreateAttemptWithCounter.mockResolvedValueOnce(makeAttempt({ student_id: "other-student" }));
            const event = makeEvent({ student_id: "other-student" }, { ...makeAuth("system-user", "System") });
            await createHandler(event);
            expect(mockCreateAttemptWithCounter).toHaveBeenCalledWith(
                "qi-1", "other-student", "q-1", "my answer", undefined, expect.any(String)
            );
        });
    });

    describe("validation", () => {
        it("returns 400 when quest_instance_id is missing", async () => {
            const res = await createHandler(makeEvent({ quest_instance_id: undefined }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain("quest_instance_id");
        });

        it("returns 400 when question_id is missing", async () => {
            const res = await createHandler(makeEvent({ question_id: undefined }));
            expect(res.statusCode).toBe(400);
        });

        it("returns 400 when answer_raw is missing", async () => {
            const res = await createHandler(makeEvent({ answer_raw: undefined }));
            expect(res.statusCode).toBe(400);
        });

        it("returns 400 when answer_raw is too long", async () => {
            const res = await createHandler(makeEvent({ answer_raw: "x".repeat(20001) }));
            expect(res.statusCode).toBe(400);
        });
    });

    describe("success", () => {
        it("returns 201 with attempt on success", async () => {
            const attempt = makeAttempt();
            mockCreateAttemptWithCounter.mockResolvedValueOnce(attempt);

            const res = await createHandler(makeEvent());

            expect(res.statusCode).toBe(201);
            const body = JSON.parse(res.body);
            expect(body.message).toContain("created");
            expect(body.attempt).toEqual(attempt);
        });

        it("passes answer_normalized when provided", async () => {
            mockCreateAttemptWithCounter.mockResolvedValueOnce(makeAttempt());
            await createHandler(makeEvent({ answer_normalized: "normalized" }));
            expect(mockCreateAttemptWithCounter).toHaveBeenCalledWith(
                expect.any(String), expect.any(String), expect.any(String),
                "my answer", "normalized", expect.any(String)
            );
        });
    });

    describe("error handling", () => {
        it("returns 500 when repo throws", async () => {
            mockCreateAttemptWithCounter.mockRejectedValueOnce(new Error("DDB fail"));
            const res = await createHandler(makeEvent());
            expect(res.statusCode).toBe(500);
            expect(JSON.parse(res.body).error).toContain("server error");
        });
    });
});

// ===========================================================================
// grade-attempt.ts
// ===========================================================================
describe("grade-attempt handler", () => {
    function makeEvent(pathOverrides: Record<string, any> = {}, bodyOverrides: Record<string, any> = {}, groups = "Teachers") {
        return {
            ...makeAuth("teacher-1", groups),
            pathParameters: {
                quest_instance_id: "qi-1",
                student_id: "s-1",
                question_id: "q-1",
                attempt_no: "1",
                ...pathOverrides,
            },
            body: JSON.stringify({
                is_correct: true,
                grader_type: "TEACHER",
                ...bodyOverrides,
            }),
        };
    }

    describe("path parameter validation", () => {
        it("returns 400 when quest_instance_id is missing", async () => {
            const res = await gradeHandler(makeEvent({ quest_instance_id: undefined }));
            expect(res.statusCode).toBe(400);
        });

        it("returns 400 when student_id is missing", async () => {
            const res = await gradeHandler(makeEvent({ student_id: undefined }));
            expect(res.statusCode).toBe(400);
        });

        it("returns 400 when attempt_no is not a number", async () => {
            const res = await gradeHandler(makeEvent({ attempt_no: "abc" }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain("attempt_no");
        });

        it("returns 400 when attempt_no is 0", async () => {
            const res = await gradeHandler(makeEvent({ attempt_no: "0" }));
            expect(res.statusCode).toBe(400);
        });
    });

    describe("auth", () => {
        it("returns 401 when userId is missing", async () => {
            const event = makeEvent();
            event.requestContext.authorizer.jwt.claims.sub = undefined as any;
            const res = await gradeHandler(event);
            expect(res.statusCode).toBe(401);
        });

        it("returns 403 when user is a student", async () => {
            const res = await gradeHandler(makeEvent({}, {}, "Students"));
            expect(res.statusCode).toBe(403);
        });

        it("allows Teachers group", async () => {
            mockUpdateAttemptGrade.mockResolvedValueOnce(undefined);
            const res = await gradeHandler(makeEvent({}, {}, "Teachers"));
            expect(res.statusCode).toBe(200);
        });

        it("allows Admins group", async () => {
            mockUpdateAttemptGrade.mockResolvedValueOnce(undefined);
            const res = await gradeHandler(makeEvent({}, {}, "Admins"));
            expect(res.statusCode).toBe(200);
        });
    });

    describe("body validation", () => {
        it("returns 400 when is_correct is not boolean", async () => {
            const res = await gradeHandler(makeEvent({}, { is_correct: "yes" }));
            expect(res.statusCode).toBe(400);
        });

        it("returns 400 for invalid grader_type", async () => {
            const res = await gradeHandler(makeEvent({}, { grader_type: "INVALID" }));
            expect(res.statusCode).toBe(400);
        });
    });

    describe("success", () => {
        it("returns 200 with graded_at on success", async () => {
            mockUpdateAttemptGrade.mockResolvedValueOnce(undefined);
            const res = await gradeHandler(makeEvent());
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.message).toContain("graded");
            expect(body.graded_at).toBeTruthy();
        });

        it("calls updateAttemptGrade with correct attempt_no", async () => {
            mockUpdateAttemptGrade.mockResolvedValueOnce(undefined);
            await gradeHandler(makeEvent({ attempt_no: "3" }));
            expect(mockUpdateAttemptGrade).toHaveBeenCalledWith(
                "qi-1", "s-1", "q-1", 3, expect.any(Object)
            );
        });
    });

    describe("error handling", () => {
        it("returns 500 when repo throws", async () => {
            mockUpdateAttemptGrade.mockRejectedValueOnce(new Error("Not found"));
            const res = await gradeHandler(makeEvent());
            expect(res.statusCode).toBe(500);
        });
    });
});

// ===========================================================================
// list-by-pk.ts
// ===========================================================================
describe("list-by-pk handler", () => {
    function makeEvent(pathOverrides: Record<string, any> = {}, queryOverrides: Record<string, any> = {}, userId = "s-1", groups = "Students") {
        return {
            ...makeAuth(userId, groups),
            pathParameters: {
                quest_instance_id: "qi-1",
                student_id: "s-1",
                question_id: "q-1",
                ...pathOverrides,
            },
            queryStringParameters: queryOverrides,
        };
    }

    describe("path parameter validation", () => {
        it("returns 400 when quest_instance_id is missing", async () => {
            const res = await listPKHandler(makeEvent({ quest_instance_id: undefined }));
            expect(res.statusCode).toBe(400);
        });

        it("returns 400 when student_id is missing", async () => {
            const res = await listPKHandler(makeEvent({ student_id: undefined }));
            expect(res.statusCode).toBe(400);
        });

        it("returns 400 when question_id is missing", async () => {
            const res = await listPKHandler(makeEvent({ question_id: undefined }));
            expect(res.statusCode).toBe(400);
        });
    });

    describe("auth", () => {
        it("returns 401 when userId is missing", async () => {
            const event = makeEvent();
            event.requestContext.authorizer.jwt.claims.sub = undefined as any;
            const res = await listPKHandler(event);
            expect(res.statusCode).toBe(401);
        });

        it("returns 403 when student tries to view another student's attempts", async () => {
            // userId = "other-user" but student_id in path = "s-1"
            const res = await listPKHandler(makeEvent({}, {}, "other-user", "Students"));
            expect(res.statusCode).toBe(403);
        });

        it("allows student to view their own attempts", async () => {
            mockQueryByPK.mockResolvedValueOnce({ items: [], cursor: undefined });
            // userId matches student_id in path
            const res = await listPKHandler(makeEvent({}, {}, "s-1", "Students"));
            expect(res.statusCode).toBe(200);
        });

        it("allows teacher to view any student's attempts", async () => {
            mockQueryByPK.mockResolvedValueOnce({ items: [], cursor: undefined });
            const res = await listPKHandler(makeEvent({}, {}, "teacher-1", "Teachers"));
            expect(res.statusCode).toBe(200);
        });
    });

    describe("success", () => {
        it("returns 200 with items and cursor", async () => {
            const items = [makeAttempt()];
            mockQueryByPK.mockResolvedValueOnce({ items, cursor: "abc" });

            const res = await listPKHandler(makeEvent({}, {}, "s-1"));

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.items).toEqual(items);
            expect(body.cursor).toBe("abc");
        });

        it("returns empty items when none found", async () => {
            mockQueryByPK.mockResolvedValueOnce({ items: [] });
            const res = await listPKHandler(makeEvent({}, {}, "s-1"));
            const body = JSON.parse(res.body);
            expect(body.items).toEqual([]);
        });

        it("forwards limit query param to queryByPK", async () => {
            mockQueryByPK.mockResolvedValueOnce({ items: [] });
            await listPKHandler(makeEvent({}, { limit: "5" }, "s-1"));
            expect(mockQueryByPK).toHaveBeenCalledWith("qi-1", "s-1", "q-1", 5, undefined);
        });

        it("forwards cursor query param to queryByPK", async () => {
            mockQueryByPK.mockResolvedValueOnce({ items: [] });
            await listPKHandler(makeEvent({}, { cursor: "cursorval" }, "s-1"));
            expect(mockQueryByPK).toHaveBeenCalledWith("qi-1", "s-1", "q-1", undefined, "cursorval");
        });
    });

    describe("error handling", () => {
        it("returns 500 when repo throws", async () => {
            mockQueryByPK.mockRejectedValueOnce(new Error("DDB failure"));
            const res = await listPKHandler(makeEvent({}, {}, "s-1"));
            expect(res.statusCode).toBe(500);
        });
    });
});

// ===========================================================================
// list-by-gsi1.ts
// ===========================================================================
describe("list-by-gsi1 handler", () => {
    function makeEvent(pathOverrides: Record<string, any> = {}, queryOverrides: Record<string, any> = {}, userId = "s-1", groups = "Students") {
        return {
            ...makeAuth(userId, groups),
            pathParameters: {
                quest_instance_id: "qi-1",
                student_id: "s-1",
                ...pathOverrides,
            },
            queryStringParameters: queryOverrides,
        };
    }

    describe("path parameter validation", () => {
        it("returns 400 when quest_instance_id is missing", async () => {
            const res = await listGSI1Handler(makeEvent({ quest_instance_id: undefined }));
            expect(res.statusCode).toBe(400);
        });

        it("returns 400 when student_id is missing", async () => {
            const res = await listGSI1Handler(makeEvent({ student_id: undefined }));
            expect(res.statusCode).toBe(400);
        });
    });

    describe("auth", () => {
        it("returns 401 when userId is missing", async () => {
            const event = makeEvent();
            event.requestContext.authorizer.jwt.claims.sub = undefined as any;
            const res = await listGSI1Handler(event);
            expect(res.statusCode).toBe(401);
        });

        it("returns 403 when student views another student's attempts", async () => {
            const res = await listGSI1Handler(makeEvent({}, {}, "other-user", "Students"));
            expect(res.statusCode).toBe(403);
        });

        it("allows student to view own attempts", async () => {
            mockQueryByGSI1.mockResolvedValueOnce({ items: [] });
            const res = await listGSI1Handler(makeEvent({}, {}, "s-1", "Students"));
            expect(res.statusCode).toBe(200);
        });
    });

    describe("success", () => {
        it("returns 200 with items", async () => {
            const items = [makeAttempt()];
            mockQueryByGSI1.mockResolvedValueOnce({ items, cursor: undefined });

            const res = await listGSI1Handler(makeEvent({}, {}, "s-1"));

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).items).toEqual(items);
        });

        it("forwards limit and cursor to queryByGSI1", async () => {
            mockQueryByGSI1.mockResolvedValueOnce({ items: [] });
            await listGSI1Handler(makeEvent({}, { limit: "10", cursor: "cur" }, "s-1"));
            expect(mockQueryByGSI1).toHaveBeenCalledWith("qi-1", "s-1", 10, "cur");
        });

        it("returns empty items when none found", async () => {
            mockQueryByGSI1.mockResolvedValueOnce({ items: [] });
            const res = await listGSI1Handler(makeEvent({}, {}, "s-1"));
            expect(JSON.parse(res.body).items).toEqual([]);
        });
    });

    describe("error handling", () => {
        it("returns 500 when repo throws", async () => {
            mockQueryByGSI1.mockRejectedValueOnce(new Error("fail"));
            const res = await listGSI1Handler(makeEvent({}, {}, "s-1"));
            expect(res.statusCode).toBe(500);
        });
    });
});

// ===========================================================================
// list-by-gsi2.ts
// ===========================================================================
describe("list-by-gsi2 handler", () => {
    function makeEvent(pathOverrides: Record<string, any> = {}, queryOverrides: Record<string, any> = {}, groups = "Teachers") {
        return {
            ...makeAuth("teacher-1", groups),
            pathParameters: {
                quest_instance_id: "qi-1",
                question_id: "q-1",
                ...pathOverrides,
            },
            queryStringParameters: queryOverrides,
        };
    }

    describe("path parameter validation", () => {
        it("returns 400 when quest_instance_id is missing", async () => {
            const res = await listGSI2Handler(makeEvent({ quest_instance_id: undefined }));
            expect(res.statusCode).toBe(400);
        });

        it("returns 400 when question_id is missing", async () => {
            const res = await listGSI2Handler(makeEvent({ question_id: undefined }));
            expect(res.statusCode).toBe(400);
        });
    });

    describe("auth", () => {
        it("returns 401 when userId is missing", async () => {
            const event = makeEvent();
            event.requestContext.authorizer.jwt.claims.sub = undefined as any;
            const res = await listGSI2Handler(event);
            expect(res.statusCode).toBe(401);
        });

        it("returns 403 for Students (teacher-only endpoint)", async () => {
            const res = await listGSI2Handler(makeEvent({}, {}, "Students"));
            expect(res.statusCode).toBe(403);
        });

        it("allows Teachers", async () => {
            mockQueryByGSI2.mockResolvedValueOnce({ items: [] });
            const res = await listGSI2Handler(makeEvent({}, {}, "Teachers"));
            expect(res.statusCode).toBe(200);
        });

        it("allows Admins", async () => {
            mockQueryByGSI2.mockResolvedValueOnce({ items: [] });
            const res = await listGSI2Handler(makeEvent({}, {}, "Admins"));
            expect(res.statusCode).toBe(200);
        });
    });

    describe("success", () => {
        it("returns 200 with items", async () => {
            const items = [makeAttempt()];
            mockQueryByGSI2.mockResolvedValueOnce({ items, cursor: "next" });

            const res = await listGSI2Handler(makeEvent());

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.items).toEqual(items);
            expect(body.cursor).toBe("next");
        });

        it("forwards limit and cursor to queryByGSI2", async () => {
            mockQueryByGSI2.mockResolvedValueOnce({ items: [] });
            await listGSI2Handler(makeEvent({}, { limit: "20", cursor: "c" }));
            expect(mockQueryByGSI2).toHaveBeenCalledWith("qi-1", "q-1", 20, "c");
        });

        it("returns empty items when none found", async () => {
            mockQueryByGSI2.mockResolvedValueOnce({ items: [] });
            const res = await listGSI2Handler(makeEvent());
            expect(JSON.parse(res.body).items).toEqual([]);
        });
    });

    describe("error handling", () => {
        it("returns 500 when repo throws", async () => {
            mockQueryByGSI2.mockRejectedValueOnce(new Error("fail"));
            const res = await listGSI2Handler(makeEvent());
            expect(res.statusCode).toBe(500);
        });
    });
});

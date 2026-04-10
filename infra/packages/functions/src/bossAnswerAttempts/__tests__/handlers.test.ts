/**
 * Unit tests for bossAnswerAttempts handlers:
 *   - list-by-battle.ts
 *   - list-by-student.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock repo functions — handlers only call listAttemptsByBattle / listAttemptsByStudent
// ---------------------------------------------------------------------------
const mockListAttemptsByBattle  = vi.fn();
const mockListAttemptsByStudent = vi.fn();

vi.mock("../repo.ts", () => ({
    listAttemptsByBattle:  (...args: any[]) => mockListAttemptsByBattle(...args),
    listAttemptsByStudent: (...args: any[]) => mockListAttemptsByStudent(...args),
}));

// ---------------------------------------------------------------------------
// Module references
// ---------------------------------------------------------------------------
let listByBattleHandler:  (typeof import("../list-by-battle.ts"))["handler"];
let listByStudentHandler: (typeof import("../list-by-student.ts"))["handler"];

beforeAll(async () => {
    listByBattleHandler  = (await import("../list-by-battle.ts")).handler;
    listByStudentHandler = (await import("../list-by-student.ts")).handler;
});

beforeEach(() => {
    mockListAttemptsByBattle.mockReset();
    mockListAttemptsByStudent.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAttemptItem(overrides: Record<string, any> = {}) {
    return {
        boss_attempt_pk:         "BI#inst-1#Q#q-1",
        attempt_sk:              "T#2026-04-09T10:00:00.000Z#S#student-1#A#uuid-1",
        boss_instance_id:        "inst-1",
        class_id:                "class-1",
        question_id:             "q-1",
        student_id:              "student-1",
        guild_id:                "guild-1",
        answer_raw:              { selected: "A" },
        is_correct:              true,
        answered_at:             "2026-04-09T10:00:00.000Z",
        elapsed_seconds:         10,
        damage_to_boss:          50,
        hearts_delta_student:    0,
        hearts_delta_guild_total: 0,
        mode_type:               "SIMULTANEOUS_ALL",
        status_at_submit:        "QUESTION_ACTIVE",
        gsi2_sk:                 "2026-04-09T10:00:00.000Z#inst-1#q-1",
        gsi3_pk:                 "inst-1#student-1",
        gsi3_sk:                 "2026-04-09T10:00:00.000Z#q-1",
        ...overrides,
    };
}

function makeBattleEvent(overrides: {
    boss_instance_id?: string | null;
    limit?: string;
    cursor?: string;
} = {}) {
    const pathParameters: Record<string, string> = {};
    if (overrides.boss_instance_id !== null) {
        pathParameters.boss_instance_id = overrides.boss_instance_id ?? "inst-1";
    }

    const queryStringParameters: Record<string, string> = {};
    if (overrides.limit)  queryStringParameters.limit  = overrides.limit;
    if (overrides.cursor) queryStringParameters.cursor = overrides.cursor;

    return {
        pathParameters: Object.keys(pathParameters).length ? pathParameters : undefined,
        queryStringParameters: Object.keys(queryStringParameters).length
            ? queryStringParameters
            : undefined,
    };
}

function makeStudentEvent(overrides: {
    student_id?: string | null;
    limit?: string;
    cursor?: string;
} = {}) {
    const pathParameters: Record<string, string> = {};
    if (overrides.student_id !== null) {
        pathParameters.student_id = overrides.student_id ?? "student-1";
    }

    const queryStringParameters: Record<string, string> = {};
    if (overrides.limit)  queryStringParameters.limit  = overrides.limit;
    if (overrides.cursor) queryStringParameters.cursor = overrides.cursor;

    return {
        pathParameters: Object.keys(pathParameters).length ? pathParameters : undefined,
        queryStringParameters: Object.keys(queryStringParameters).length
            ? queryStringParameters
            : undefined,
    };
}

// ---------------------------------------------------------------------------
// list-by-battle handler
// ---------------------------------------------------------------------------
describe("list-by-battle handler", () => {
    it("returns 200 with items, count, and nextToken for a valid request", async () => {
        const item = makeAttemptItem();
        mockListAttemptsByBattle.mockResolvedValue({
            items: [item],
            nextToken: undefined,
        });

        const res = await listByBattleHandler(makeBattleEvent());

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.count).toBe(1);
        expect(body.items[0].boss_instance_id).toBe("inst-1");
        expect(body.nextToken).toBeUndefined();
    });

    it("returns 400 when boss_instance_id path parameter is missing", async () => {
        const res = await listByBattleHandler({ pathParameters: undefined });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("boss_instance_id");
        expect(mockListAttemptsByBattle).not.toHaveBeenCalled();
    });

    it("returns 400 when pathParameters exists but boss_instance_id is absent", async () => {
        const res = await listByBattleHandler({ pathParameters: {} });

        expect(res.statusCode).toBe(400);
        expect(mockListAttemptsByBattle).not.toHaveBeenCalled();
    });

    it("passes parsed limit to the repo", async () => {
        mockListAttemptsByBattle.mockResolvedValue({ items: [], nextToken: undefined });

        await listByBattleHandler(makeBattleEvent({ limit: "20" }));

        expect(mockListAttemptsByBattle).toHaveBeenCalledWith("inst-1", {
            limit: 20,
            nextToken: undefined,
        });
    });

    it("passes cursor as nextToken to the repo", async () => {
        mockListAttemptsByBattle.mockResolvedValue({ items: [], nextToken: undefined });

        await listByBattleHandler(makeBattleEvent({ cursor: "abc123token" }));

        expect(mockListAttemptsByBattle).toHaveBeenCalledWith("inst-1", {
            limit: undefined,
            nextToken: "abc123token",
        });
    });

    it("includes nextToken in response body when repo returns one", async () => {
        mockListAttemptsByBattle.mockResolvedValue({
            items: [makeAttemptItem()],
            nextToken: "page2token==",
        });

        const res = await listByBattleHandler(makeBattleEvent());

        const body = JSON.parse(res.body);
        expect(body.nextToken).toBe("page2token==");
        expect(body.count).toBe(1);
    });

    it("returns 200 with empty items when the battle has no attempts", async () => {
        mockListAttemptsByBattle.mockResolvedValue({ items: [], nextToken: undefined });

        const res = await listByBattleHandler(makeBattleEvent());

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toEqual([]);
        expect(body.count).toBe(0);
        expect(body.nextToken).toBeUndefined();
    });

    it("returns 500 when the repo throws", async () => {
        mockListAttemptsByBattle.mockRejectedValue(new Error("DynamoDB error"));

        const res = await listByBattleHandler(makeBattleEvent());

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("DynamoDB error");
    });

    it("calls repo with undefined limit when limit query param is absent", async () => {
        mockListAttemptsByBattle.mockResolvedValue({ items: [], nextToken: undefined });

        // No limit in query string
        await listByBattleHandler(makeBattleEvent());

        expect(mockListAttemptsByBattle).toHaveBeenCalledWith("inst-1", {
            limit: undefined,
            nextToken: undefined,
        });
    });
});

// ---------------------------------------------------------------------------
// list-by-student handler
// ---------------------------------------------------------------------------
describe("list-by-student handler", () => {
    it("returns 200 with items and count for a valid request", async () => {
        mockListAttemptsByStudent.mockResolvedValue({
            items: [makeAttemptItem(), makeAttemptItem({ question_id: "q-2" })],
            nextToken: undefined,
        });

        const res = await listByStudentHandler(makeStudentEvent());

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(2);
        expect(body.count).toBe(2);
        expect(body.nextToken).toBeUndefined();
    });

    it("returns 400 when student_id path parameter is missing", async () => {
        const res = await listByStudentHandler({ pathParameters: undefined });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("student_id");
        expect(mockListAttemptsByStudent).not.toHaveBeenCalled();
    });

    it("returns 400 when pathParameters exists but student_id is absent", async () => {
        const res = await listByStudentHandler({ pathParameters: {} });

        expect(res.statusCode).toBe(400);
        expect(mockListAttemptsByStudent).not.toHaveBeenCalled();
    });

    it("passes parsed limit to the repo", async () => {
        mockListAttemptsByStudent.mockResolvedValue({ items: [], nextToken: undefined });

        await listByStudentHandler(makeStudentEvent({ limit: "5" }));

        expect(mockListAttemptsByStudent).toHaveBeenCalledWith("student-1", {
            limit: 5,
            nextToken: undefined,
        });
    });

    it("passes cursor as nextToken to the repo", async () => {
        mockListAttemptsByStudent.mockResolvedValue({ items: [], nextToken: undefined });

        await listByStudentHandler(makeStudentEvent({ cursor: "nextpagetoken" }));

        expect(mockListAttemptsByStudent).toHaveBeenCalledWith("student-1", {
            limit: undefined,
            nextToken: "nextpagetoken",
        });
    });

    it("includes nextToken in response body when repo returns one", async () => {
        mockListAttemptsByStudent.mockResolvedValue({
            items: [makeAttemptItem()],
            nextToken: "continuationtoken==",
        });

        const res = await listByStudentHandler(makeStudentEvent());

        const body = JSON.parse(res.body);
        expect(body.nextToken).toBe("continuationtoken==");
    });

    it("returns 200 with empty items when student has no attempts", async () => {
        mockListAttemptsByStudent.mockResolvedValue({ items: [], nextToken: undefined });

        const res = await listByStudentHandler(makeStudentEvent());

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toEqual([]);
        expect(body.count).toBe(0);
    });

    it("returns 500 when the repo throws", async () => {
        mockListAttemptsByStudent.mockRejectedValue(new Error("ServiceUnavailable"));

        const res = await listByStudentHandler(makeStudentEvent());

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("ServiceUnavailable");
    });

    it("calls repo with undefined limit when limit query param is absent", async () => {
        mockListAttemptsByStudent.mockResolvedValue({ items: [], nextToken: undefined });

        await listByStudentHandler(makeStudentEvent());

        expect(mockListAttemptsByStudent).toHaveBeenCalledWith("student-1", {
            limit: undefined,
            nextToken: undefined,
        });
    });
});

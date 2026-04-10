/**
 * Unit tests for bossBattleQuestionPlans/get-plan.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/bossBattleQuestionPlans
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock repo — handler only calls getQuestionPlan
// ---------------------------------------------------------------------------
const mockGetQuestionPlan = vi.fn();

vi.mock("../repo.ts", () => ({
    getQuestionPlan: (...args: any[]) => mockGetQuestionPlan(...args),
}));

// ---------------------------------------------------------------------------
// Module reference
// ---------------------------------------------------------------------------
let handler: (typeof import("../get-plan.ts"))["handler"];

beforeAll(async () => {
    handler = (await import("../get-plan.ts")).handler;
});

beforeEach(() => {
    mockGetQuestionPlan.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePlan(overrides: Record<string, any> = {}) {
    return {
        plan_id:                 "plan-1",
        boss_instance_id:        "inst-1",
        class_id:                "class-1",
        boss_template_id:        "template-1",
        mode_type:               "SIMULTANEOUS_ALL",
        question_selection_mode: "ORDERED",
        created_by_teacher_id:   "teacher-1",
        created_at:              "2026-04-10T10:00:00.000Z",
        version:                 1,
        question_ids:            ["q-1", "q-2"],
        question_count:          2,
        seed:                    "some-seed",
        ...overrides,
    };
}

function makeEvent(planId: string | undefined) {
    return {
        pathParameters: planId !== undefined ? { plan_id: planId } : undefined,
    };
}

// ---------------------------------------------------------------------------
// get-plan handler
// ---------------------------------------------------------------------------
describe("get-plan handler", () => {
    it("returns 200 with full plan body on success", async () => {
        const plan = makePlan();
        mockGetQuestionPlan.mockResolvedValue(plan);

        const res = await handler(makeEvent("plan-1") as any);

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.plan_id).toBe("plan-1");
        expect(body.boss_instance_id).toBe("inst-1");
        expect(body.question_ids).toEqual(["q-1", "q-2"]);
        expect(body.question_count).toBe(2);
    });

    it("returns 400 when plan_id is missing from pathParameters", async () => {
        const res = await handler({ pathParameters: undefined } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("plan_id");
        expect(mockGetQuestionPlan).not.toHaveBeenCalled();
    });

    it("returns 400 when pathParameters exists but plan_id is absent", async () => {
        const res = await handler({ pathParameters: {} } as any);

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("plan_id");
        expect(mockGetQuestionPlan).not.toHaveBeenCalled();
    });

    it("returns 404 when plan is not found", async () => {
        mockGetQuestionPlan.mockResolvedValue(null);

        const res = await handler(makeEvent("missing-plan") as any);

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toContain("not found");
    });

    it("returns 500 when repo throws", async () => {
        mockGetQuestionPlan.mockRejectedValue(new Error("DynamoDB unavailable"));

        const res = await handler(makeEvent("plan-1") as any);

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("DynamoDB unavailable");
    });

    it("passes plan_id to repo", async () => {
        mockGetQuestionPlan.mockResolvedValue(makePlan({ plan_id: "plan-xyz" }));

        await handler(makeEvent("plan-xyz") as any);

        expect(mockGetQuestionPlan).toHaveBeenCalledWith("plan-xyz");
    });

    it("returns full plan shape including mode_type and version", async () => {
        mockGetQuestionPlan.mockResolvedValue(
            makePlan({ mode_type: "RANDOMIZED_PER_GUILD", version: 2 })
        );

        const res = await handler(makeEvent("plan-1") as any);

        const body = JSON.parse(res.body);
        expect(body.mode_type).toBe("RANDOMIZED_PER_GUILD");
        expect(body.version).toBe(2);
    });
});

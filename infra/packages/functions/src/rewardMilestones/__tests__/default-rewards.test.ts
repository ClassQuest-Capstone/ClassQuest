import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Mock repo (default-rewards.ts imports from ./repo.js)              */
/* ------------------------------------------------------------------ */
const mockCreateRewardMilestone = vi.fn();

const repoExports = {
    createRewardMilestone: (...args: any[]) => mockCreateRewardMilestone(...args),
};
vi.mock("../repo.ts", () => repoExports);
vi.mock("../repo.js", () => repoExports);

/* ------------------------------------------------------------------ */
/*  Module under test                                                  */
/* ------------------------------------------------------------------ */
let createDefaultRewardMilestones: typeof import("../default-rewards.ts")["createDefaultRewardMilestones"];

beforeAll(async () => {
    createDefaultRewardMilestones = (await import("../default-rewards.ts")).createDefaultRewardMilestones;
});

beforeEach(() => {
    mockCreateRewardMilestone.mockReset();
    mockCreateRewardMilestone.mockResolvedValue(undefined);
});

/* ================================================================== */
/*  createDefaultRewardMilestones                                      */
/* ================================================================== */
describe("createDefaultRewardMilestones", () => {
    it("creates exactly 12 default rewards", async () => {
        await createDefaultRewardMilestones("class-1", "teacher-1");

        expect(mockCreateRewardMilestone).toHaveBeenCalledTimes(12);
    });

    it("assigns the provided class_id and teacher_id to every reward", async () => {
        await createDefaultRewardMilestones("class-42", "teacher-99");

        for (const [item] of mockCreateRewardMilestone.mock.calls) {
            expect(item.class_id).toBe("class-42");
            expect(item.created_by_teacher_id).toBe("teacher-99");
        }
    });

    it("generates unique reward_id for each reward", async () => {
        await createDefaultRewardMilestones("c-1", "t-1");

        const ids = mockCreateRewardMilestone.mock.calls.map(([item]: any) => item.reward_id);
        expect(new Set(ids).size).toBe(12);
    });

    it("creates all rewards as active and not deleted", async () => {
        await createDefaultRewardMilestones("c-1", "t-1");

        for (const [item] of mockCreateRewardMilestone.mock.calls) {
            expect(item.is_active).toBe(true);
            expect(item.is_deleted).toBe(false);
        }
    });

    it("includes unlock_sort and teacher_sort on each reward", async () => {
        await createDefaultRewardMilestones("c-1", "t-1");

        for (const [item] of mockCreateRewardMilestone.mock.calls) {
            expect(item.unlock_sort).toMatch(/^ACTIVE#/);
            expect(item.teacher_sort).toMatch(/^c-1#ACTIVE#/);
        }
    });

    it("propagates repo errors", async () => {
        mockCreateRewardMilestone.mockRejectedValue(new Error("DDB boom"));

        await expect(createDefaultRewardMilestones("c-1", "t-1")).rejects.toThrow("DDB boom");
    });
});

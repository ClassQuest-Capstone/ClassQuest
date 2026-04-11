import { describe, it, expect } from "vitest";
import { buildUnlockSort, buildTeacherSort, REWARD_TYPES, REWARD_TARGET_TYPES } from "../keys.ts";

/* ================================================================== */
/*  buildUnlockSort                                                    */
/* ================================================================== */
describe("buildUnlockSort", () => {
    it("returns ACTIVE prefix when is_active is true", () => {
        const result = buildUnlockSort(true, 5, "HELMET", "r-1");
        expect(result).toMatch(/^ACTIVE#/);
    });

    it("returns INACTIVE prefix when is_active is false", () => {
        const result = buildUnlockSort(false, 5, "HELMET", "r-1");
        expect(result).toMatch(/^INACTIVE#/);
    });

    it("zero-pads level to 5 digits", () => {
        const result = buildUnlockSort(true, 7, "PET", "r-1");
        expect(result).toBe("ACTIVE#00007#PET#r-1");
    });

    it("handles large level numbers", () => {
        const result = buildUnlockSort(true, 99999, "BADGE", "r-1");
        expect(result).toBe("ACTIVE#99999#BADGE#r-1");
    });

    it("includes type and reward_id in correct positions", () => {
        const result = buildUnlockSort(false, 10, "ARMOR_SET", "reward-abc");
        expect(result).toBe("INACTIVE#00010#ARMOR_SET#reward-abc");
    });
});

/* ================================================================== */
/*  buildTeacherSort                                                   */
/* ================================================================== */
describe("buildTeacherSort", () => {
    it("prefixes with class_id", () => {
        const result = buildTeacherSort("class-1", true, 5, "r-1");
        expect(result).toMatch(/^class-1#/);
    });

    it("includes ACTIVE prefix for active rewards", () => {
        const result = buildTeacherSort("c-1", true, 10, "r-1");
        expect(result).toBe("c-1#ACTIVE#00010#r-1");
    });

    it("includes INACTIVE prefix for inactive rewards", () => {
        const result = buildTeacherSort("c-1", false, 10, "r-1");
        expect(result).toBe("c-1#INACTIVE#00010#r-1");
    });

    it("zero-pads level to 5 digits", () => {
        const result = buildTeacherSort("c-1", true, 3, "r-1");
        expect(result).toContain("#00003#");
    });
});

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */
describe("REWARD_TYPES", () => {
    it("contains expected types", () => {
        expect(REWARD_TYPES).toContain("HELMET");
        expect(REWARD_TYPES).toContain("ARMOR_SET");
        expect(REWARD_TYPES).toContain("WEAPON");
        expect(REWARD_TYPES).toContain("PET");
        expect(REWARD_TYPES).toContain("CUSTOM");
        expect(REWARD_TYPES.length).toBe(8);
    });
});

describe("REWARD_TARGET_TYPES", () => {
    it("contains expected types", () => {
        expect(REWARD_TARGET_TYPES).toContain("ITEM");
        expect(REWARD_TARGET_TYPES).toContain("AVATAR_TIER");
        expect(REWARD_TARGET_TYPES).toContain("CUSTOM");
        expect(REWARD_TARGET_TYPES.length).toBe(6);
    });
});

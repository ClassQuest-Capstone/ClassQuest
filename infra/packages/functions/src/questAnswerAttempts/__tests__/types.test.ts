/**
 * Unit tests for questAnswerAttempts/types.ts (key builder functions)
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questAnswerAttempts
 */
import { describe, it, expect } from "vitest";
import {
    buildQuestAttemptPK,
    buildAttemptSK,
    buildGSIKeys,
    buildCounterPK,
} from "../types.js";

describe("buildQuestAttemptPK", () => {
    it("produces the correct format", () => {
        expect(buildQuestAttemptPK("qi-1", "s-1", "q-1")).toBe("QI#qi-1#S#s-1#Q#q-1");
    });

    it("includes all three components", () => {
        const pk = buildQuestAttemptPK("instance-abc", "student-xyz", "question-999");
        expect(pk).toContain("QI#instance-abc");
        expect(pk).toContain("S#student-xyz");
        expect(pk).toContain("Q#question-999");
    });
});

describe("buildAttemptSK", () => {
    it("produces the correct format", () => {
        const sk = buildAttemptSK(1, "2024-01-01T00:00:00.000Z");
        expect(sk).toBe("A#000001#T#2024-01-01T00:00:00.000Z");
    });

    it("pads attempt_no to 6 digits", () => {
        expect(buildAttemptSK(1, "ts")).toMatch(/^A#000001#/);
        expect(buildAttemptSK(42, "ts")).toMatch(/^A#000042#/);
        expect(buildAttemptSK(999999, "ts")).toMatch(/^A#999999#/);
    });

    it("includes the timestamp after T#", () => {
        const sk = buildAttemptSK(5, "2025-06-15T12:00:00.000Z");
        expect(sk).toContain("T#2025-06-15T12:00:00.000Z");
    });
});

describe("buildGSIKeys", () => {
    const ts = "2024-01-01T00:00:00.000Z";
    const keys = buildGSIKeys("qi-1", "s-1", "q-1", 1, ts);

    it("gsi1_pk is S#<student>#QI#<instance>", () => {
        expect(keys.gsi1_pk).toBe("S#s-1#QI#qi-1");
    });

    it("gsi1_sk starts with T# and includes question and attempt", () => {
        expect(keys.gsi1_sk).toContain(`T#${ts}`);
        expect(keys.gsi1_sk).toContain("Q#q-1");
        expect(keys.gsi1_sk).toContain("A#000001");
    });

    it("gsi2_pk is QI#<instance>#Q#<question>", () => {
        expect(keys.gsi2_pk).toBe("QI#qi-1#Q#q-1");
    });

    it("gsi2_sk starts with T# and includes student and attempt", () => {
        expect(keys.gsi2_sk).toContain(`T#${ts}`);
        expect(keys.gsi2_sk).toContain("S#s-1");
        expect(keys.gsi2_sk).toContain("A#000001");
    });

    it("pads attempt_no to 6 digits in GSI keys", () => {
        const k = buildGSIKeys("qi", "s", "q", 3, "ts");
        expect(k.gsi1_sk).toContain("A#000003");
        expect(k.gsi2_sk).toContain("A#000003");
    });
});

describe("buildCounterPK", () => {
    it("produces the correct format", () => {
        expect(buildCounterPK("qi-1", "s-1", "q-1")).toBe("COUNTER#QI#qi-1#S#s-1#Q#q-1");
    });

    it("starts with COUNTER#", () => {
        expect(buildCounterPK("a", "b", "c")).toMatch(/^COUNTER#/);
    });
});

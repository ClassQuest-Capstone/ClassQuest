/**
 * Unit tests for questQuestionResponses/validation.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questQuestionResponses
 */
import { describe, it, expect } from "vitest";
import {
    validateStatus,
    validateRewardStatus,
    validateNonNegative,
    validateRewardTxnId,
    validateSummaryAndRewardFields,
} from "../validation.js";

// ---------------------------------------------------------------------------
// validateStatus
// ---------------------------------------------------------------------------
describe("validateStatus", () => {
    it("accepts all valid ResponseStatus values", () => {
        for (const s of ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "NEEDS_REVIEW", "INCORRECT", "CORRECT", "GRADED"]) {
            expect(validateStatus(s).valid).toBe(true);
        }
    });

    it("rejects an invalid status", () => {
        const result = validateStatus("DONE");
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/must be one of/);
    });
});

// ---------------------------------------------------------------------------
// validateRewardStatus
// ---------------------------------------------------------------------------
describe("validateRewardStatus", () => {
    it("accepts all valid RewardStatus values", () => {
        for (const s of ["PENDING", "APPLIED", "REVERSED"]) {
            expect(validateRewardStatus(s).valid).toBe(true);
        }
    });

    it("rejects an invalid reward_status", () => {
        const result = validateRewardStatus("UNKNOWN");
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/reward_status must be one of/);
    });
});

// ---------------------------------------------------------------------------
// validateNonNegative
// ---------------------------------------------------------------------------
describe("validateNonNegative", () => {
    it("accepts 0", () => {
        expect(validateNonNegative(0, "xp")).toEqual({ valid: true });
    });

    it("accepts positive numbers", () => {
        expect(validateNonNegative(100, "xp")).toEqual({ valid: true });
    });

    it("rejects negative numbers", () => {
        const result = validateNonNegative(-1, "xp");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("xp");
    });

    it("rejects non-numbers (string)", () => {
        const result = validateNonNegative("5" as any, "xp");
        expect(result.valid).toBe(false);
    });

    it("includes fieldName in error message", () => {
        const result = validateNonNegative(-5, "gold_awarded_total");
        expect(result.error).toContain("gold_awarded_total");
    });
});

// ---------------------------------------------------------------------------
// validateRewardTxnId
// ---------------------------------------------------------------------------
describe("validateRewardTxnId", () => {
    it("accepts a non-empty string", () => {
        expect(validateRewardTxnId("txn-abc")).toEqual({ valid: true });
    });

    it("rejects empty string", () => {
        const result = validateRewardTxnId("");
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/non-empty/);
    });

    it("rejects whitespace-only string", () => {
        const result = validateRewardTxnId("   ");
        expect(result.valid).toBe(false);
    });

    it("rejects non-string", () => {
        const result = validateRewardTxnId(123 as any);
        expect(result.valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// validateSummaryAndRewardFields
// ---------------------------------------------------------------------------
describe("validateSummaryAndRewardFields", () => {
    it("returns valid for empty input", () => {
        expect(validateSummaryAndRewardFields({})).toEqual({ valid: true });
    });

    it("accepts all valid fields together", () => {
        expect(validateSummaryAndRewardFields({
            attempt_count: 2,
            wrong_attempt_count: 1,
            status: "GRADED",
            xp_awarded_total: 50,
            gold_awarded_total: 10,
            reward_txn_id: "txn-xyz",
            reward_status: "APPLIED",
        })).toEqual({ valid: true });
    });

    it("rejects negative attempt_count", () => {
        const result = validateSummaryAndRewardFields({ attempt_count: -1 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain("attempt_count");
    });

    it("rejects negative wrong_attempt_count", () => {
        const result = validateSummaryAndRewardFields({ wrong_attempt_count: -1 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain("wrong_attempt_count");
    });

    it("rejects invalid status", () => {
        const result = validateSummaryAndRewardFields({ status: "DONE" });
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/status must be one of/);
    });

    it("rejects negative xp_awarded_total", () => {
        const result = validateSummaryAndRewardFields({ xp_awarded_total: -5 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain("xp_awarded_total");
    });

    it("rejects negative gold_awarded_total", () => {
        const result = validateSummaryAndRewardFields({ gold_awarded_total: -1 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain("gold_awarded_total");
    });

    it("rejects empty reward_txn_id", () => {
        const result = validateSummaryAndRewardFields({ reward_txn_id: "" });
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/non-empty/);
    });

    it("rejects invalid reward_status", () => {
        const result = validateSummaryAndRewardFields({ reward_status: "DONE" });
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/reward_status must be one of/);
    });

    it("skips undefined fields without error", () => {
        expect(validateSummaryAndRewardFields({
            attempt_count: undefined,
            status: undefined,
            xp_awarded_total: undefined,
        })).toEqual({ valid: true });
    });
});

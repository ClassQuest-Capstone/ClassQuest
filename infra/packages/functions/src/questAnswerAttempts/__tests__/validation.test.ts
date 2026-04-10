/**
 * Unit tests for questAnswerAttempts/validation.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questAnswerAttempts
 */
import { describe, it, expect } from "vitest";
import {
    validateRequiredIds,
    validateAnswerRaw,
    validateTeacherGradeStatus,
    validateGraderType,
    validateRewardAmounts,
    validateRewardTxnId,
    validateCreateAttemptData,
    validateGradeAttemptData,
} from "../validation.js";

// ---------------------------------------------------------------------------
// validateRequiredIds
// ---------------------------------------------------------------------------
describe("validateRequiredIds", () => {
    it("returns valid for all present ids", () => {
        expect(validateRequiredIds({ quest_instance_id: "qi-1", student_id: "s-1", question_id: "q-1" })).toEqual({ valid: true });
    });

    it("returns invalid when quest_instance_id is missing", () => {
        const r = validateRequiredIds({ student_id: "s-1", question_id: "q-1" });
        expect(r.valid).toBe(false);
        expect(r.error).toContain("quest_instance_id");
    });

    it("returns invalid when student_id is missing", () => {
        const r = validateRequiredIds({ quest_instance_id: "qi-1", question_id: "q-1" });
        expect(r.valid).toBe(false);
        expect(r.error).toContain("student_id");
    });

    it("returns invalid when question_id is missing", () => {
        const r = validateRequiredIds({ quest_instance_id: "qi-1", student_id: "s-1" });
        expect(r.valid).toBe(false);
        expect(r.error).toContain("question_id");
    });

    it("returns invalid when quest_instance_id is empty string", () => {
        const r = validateRequiredIds({ quest_instance_id: "", student_id: "s-1", question_id: "q-1" });
        expect(r.valid).toBe(false);
    });

    it("returns invalid when quest_instance_id is not a string", () => {
        const r = validateRequiredIds({ quest_instance_id: 123 as any, student_id: "s-1", question_id: "q-1" });
        expect(r.valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// validateAnswerRaw
// ---------------------------------------------------------------------------
describe("validateAnswerRaw", () => {
    it("returns valid for a non-empty string", () => {
        expect(validateAnswerRaw("my answer")).toEqual({ valid: true });
    });

    it("returns invalid when answer_raw is missing", () => {
        const r = validateAnswerRaw(undefined);
        expect(r.valid).toBe(false);
        expect(r.error).toContain("required");
    });

    it("returns invalid when answer_raw is empty string", () => {
        const r = validateAnswerRaw("");
        expect(r.valid).toBe(false);
    });

    it("returns invalid when answer_raw is not a string", () => {
        const r = validateAnswerRaw(42);
        expect(r.valid).toBe(false);
    });

    it("returns invalid when answer_raw exceeds 20000 characters", () => {
        const r = validateAnswerRaw("x".repeat(20001));
        expect(r.valid).toBe(false);
        expect(r.error).toContain("20000");
    });

    it("accepts answer_raw exactly at 20000 characters", () => {
        expect(validateAnswerRaw("x".repeat(20000))).toEqual({ valid: true });
    });
});

// ---------------------------------------------------------------------------
// validateTeacherGradeStatus
// ---------------------------------------------------------------------------
describe("validateTeacherGradeStatus", () => {
    it("accepts PENDING", () => {
        expect(validateTeacherGradeStatus("PENDING")).toEqual({ valid: true });
    });

    it("accepts GRADED", () => {
        expect(validateTeacherGradeStatus("GRADED")).toEqual({ valid: true });
    });

    it("rejects unknown status", () => {
        const r = validateTeacherGradeStatus("UNKNOWN");
        expect(r.valid).toBe(false);
        expect(r.error).toContain("PENDING");
        expect(r.error).toContain("GRADED");
    });
});

// ---------------------------------------------------------------------------
// validateGraderType
// ---------------------------------------------------------------------------
describe("validateGraderType", () => {
    it("accepts AUTO", () => {
        expect(validateGraderType("AUTO")).toEqual({ valid: true });
    });

    it("accepts TEACHER", () => {
        expect(validateGraderType("TEACHER")).toEqual({ valid: true });
    });

    it("accepts SYSTEM", () => {
        expect(validateGraderType("SYSTEM")).toEqual({ valid: true });
    });

    it("rejects unknown type", () => {
        const r = validateGraderType("ROBOT");
        expect(r.valid).toBe(false);
        expect(r.error).toContain("AUTO");
    });
});

// ---------------------------------------------------------------------------
// validateRewardAmounts
// ---------------------------------------------------------------------------
describe("validateRewardAmounts", () => {
    it("returns valid when both fields are absent", () => {
        expect(validateRewardAmounts({})).toEqual({ valid: true });
    });

    it("returns valid when both fields are 0", () => {
        expect(validateRewardAmounts({ xp_awarded: 0, gold_awarded: 0 })).toEqual({ valid: true });
    });

    it("returns invalid when xp_awarded is negative", () => {
        const r = validateRewardAmounts({ xp_awarded: -1 });
        expect(r.valid).toBe(false);
        expect(r.error).toContain("xp_awarded");
    });

    it("returns invalid when xp_awarded is not a number", () => {
        const r = validateRewardAmounts({ xp_awarded: "100" as any });
        expect(r.valid).toBe(false);
    });

    it("returns invalid when gold_awarded is negative", () => {
        const r = validateRewardAmounts({ gold_awarded: -5 });
        expect(r.valid).toBe(false);
        expect(r.error).toContain("gold_awarded");
    });
});

// ---------------------------------------------------------------------------
// validateRewardTxnId
// ---------------------------------------------------------------------------
describe("validateRewardTxnId", () => {
    it("returns valid when reward_txn_id is absent", () => {
        expect(validateRewardTxnId(undefined)).toEqual({ valid: true });
    });

    it("returns valid for a non-empty string", () => {
        expect(validateRewardTxnId("txn-abc")).toEqual({ valid: true });
    });

    it("returns invalid when reward_txn_id is empty string", () => {
        const r = validateRewardTxnId("");
        expect(r.valid).toBe(false);
    });

    it("returns invalid when reward_txn_id is whitespace only", () => {
        const r = validateRewardTxnId("   ");
        expect(r.valid).toBe(false);
    });

    it("returns invalid when reward_txn_id is not a string", () => {
        const r = validateRewardTxnId(123);
        expect(r.valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// validateCreateAttemptData
// ---------------------------------------------------------------------------
describe("validateCreateAttemptData", () => {
    function valid(overrides: Record<string, any> = {}) {
        return {
            quest_instance_id: "qi-1",
            student_id: "s-1",
            question_id: "q-1",
            answer_raw: "my answer",
            ...overrides,
        };
    }

    it("returns valid for complete valid input", () => {
        expect(validateCreateAttemptData(valid())).toEqual({ valid: true });
    });

    it("returns invalid when quest_instance_id is missing", () => {
        expect(validateCreateAttemptData(valid({ quest_instance_id: undefined }))).toMatchObject({ valid: false });
    });

    it("returns invalid when answer_raw is missing", () => {
        expect(validateCreateAttemptData(valid({ answer_raw: undefined }))).toMatchObject({ valid: false });
    });

    it("accepts optional answer_normalized", () => {
        expect(validateCreateAttemptData(valid({ answer_normalized: "normalized" }))).toEqual({ valid: true });
    });
});

// ---------------------------------------------------------------------------
// validateGradeAttemptData
// ---------------------------------------------------------------------------
describe("validateGradeAttemptData", () => {
    it("returns valid for empty data (all fields optional)", () => {
        expect(validateGradeAttemptData({})).toEqual({ valid: true });
    });

    it("returns valid with all fields provided correctly", () => {
        expect(validateGradeAttemptData({
            is_correct: true,
            grader_type: "AUTO",
            teacher_grade_status: "GRADED",
            xp_awarded: 50,
            gold_awarded: 10,
            reward_txn_id: "txn-1",
        })).toEqual({ valid: true });
    });

    it("returns invalid when is_correct is not a boolean", () => {
        const r = validateGradeAttemptData({ is_correct: "yes" as any });
        expect(r.valid).toBe(false);
        expect(r.error).toContain("is_correct");
    });

    it("returns invalid for bad grader_type", () => {
        const r = validateGradeAttemptData({ grader_type: "INVALID" });
        expect(r.valid).toBe(false);
    });

    it("returns invalid for bad teacher_grade_status", () => {
        const r = validateGradeAttemptData({ teacher_grade_status: "WRONG" });
        expect(r.valid).toBe(false);
    });

    it("returns invalid when xp_awarded is negative", () => {
        const r = validateGradeAttemptData({ xp_awarded: -1 });
        expect(r.valid).toBe(false);
    });

    it("returns invalid when reward_txn_id is whitespace", () => {
        const r = validateGradeAttemptData({ reward_txn_id: "  " });
        expect(r.valid).toBe(false);
    });
});

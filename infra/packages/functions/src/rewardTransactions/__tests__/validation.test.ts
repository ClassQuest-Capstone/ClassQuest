import { describe, it, expect } from "vitest";
import {
    validateTransactionId,
    validateSourceType,
    validateCreatedByRole,
    validateDeltas,
    validateSourceLinkage,
    validateTransactionData,
} from "../validation.ts";
import { SourceType } from "../types.ts";

/* ================================================================== */
/*  validateTransactionId                                              */
/* ================================================================== */
describe("validateTransactionId", () => {
    it("returns valid for a normal string", () => {
        expect(validateTransactionId("tx-123").valid).toBe(true);
    });

    it("returns invalid for empty string", () => {
        expect(validateTransactionId("").valid).toBe(false);
    });

    it("returns invalid for non-string", () => {
        expect(validateTransactionId(null as any).valid).toBe(false);
    });

    it("returns invalid when > 200 characters", () => {
        expect(validateTransactionId("x".repeat(201)).valid).toBe(false);
    });

    it("returns valid at exactly 200 characters", () => {
        expect(validateTransactionId("x".repeat(200)).valid).toBe(true);
    });
});

/* ================================================================== */
/*  validateSourceType                                                 */
/* ================================================================== */
describe("validateSourceType", () => {
    it("returns valid for QUEST_QUESTION", () => {
        expect(validateSourceType("QUEST_QUESTION").valid).toBe(true);
    });

    it("returns valid for BOSS_BATTLE", () => {
        expect(validateSourceType("BOSS_BATTLE").valid).toBe(true);
    });

    it("returns valid for MANUAL_ADJUSTMENT", () => {
        expect(validateSourceType("MANUAL_ADJUSTMENT").valid).toBe(true);
    });

    it("returns invalid for unknown type", () => {
        expect(validateSourceType("UNKNOWN").valid).toBe(false);
    });
});

/* ================================================================== */
/*  validateCreatedByRole                                              */
/* ================================================================== */
describe("validateCreatedByRole", () => {
    it("returns valid for TEACHER", () => {
        expect(validateCreatedByRole("TEACHER").valid).toBe(true);
    });

    it("returns valid for SYSTEM", () => {
        expect(validateCreatedByRole("SYSTEM").valid).toBe(true);
    });

    it("returns invalid for unknown role", () => {
        expect(validateCreatedByRole("SUPERADMIN").valid).toBe(false);
    });
});

/* ================================================================== */
/*  validateDeltas                                                     */
/* ================================================================== */
describe("validateDeltas", () => {
    it("returns valid when xp_delta is non-zero", () => {
        expect(validateDeltas(10, 0, 0).valid).toBe(true);
    });

    it("returns valid when gold_delta is non-zero", () => {
        expect(validateDeltas(0, 5, 0).valid).toBe(true);
    });

    it("returns valid when hearts_delta is non-zero", () => {
        expect(validateDeltas(0, 0, -1).valid).toBe(true);
    });

    it("returns invalid when all deltas are zero", () => {
        expect(validateDeltas(0, 0, 0).valid).toBe(false);
    });

    it("returns invalid when a delta is not a number", () => {
        expect(validateDeltas("x" as any, 0, 0).valid).toBe(false);
    });
});

/* ================================================================== */
/*  validateSourceLinkage                                              */
/* ================================================================== */
describe("validateSourceLinkage", () => {
    it("returns valid for QUEST_QUESTION with required fields", () => {
        expect(
            validateSourceLinkage({
                source_type: SourceType.QUEST_QUESTION,
                quest_instance_id: "qi-1",
                question_id: "q-1",
            }).valid
        ).toBe(true);
    });

    it("returns invalid for QUEST_QUESTION missing quest_instance_id", () => {
        expect(
            validateSourceLinkage({
                source_type: SourceType.QUEST_QUESTION,
                question_id: "q-1",
            }).valid
        ).toBe(false);
    });

    it("returns invalid for QUEST_QUESTION missing question_id", () => {
        expect(
            validateSourceLinkage({
                source_type: SourceType.QUEST_QUESTION,
                quest_instance_id: "qi-1",
            }).valid
        ).toBe(false);
    });

    it("returns valid for BOSS_BATTLE with boss_battle_instance_id", () => {
        expect(
            validateSourceLinkage({
                source_type: SourceType.BOSS_BATTLE,
                boss_battle_instance_id: "bb-1",
            }).valid
        ).toBe(true);
    });

    it("returns invalid for BOSS_BATTLE missing boss_battle_instance_id", () => {
        expect(
            validateSourceLinkage({
                source_type: SourceType.BOSS_BATTLE,
            }).valid
        ).toBe(false);
    });

    it("returns valid for MANUAL_ADJUSTMENT with no extra fields", () => {
        expect(
            validateSourceLinkage({
                source_type: SourceType.MANUAL_ADJUSTMENT,
            }).valid
        ).toBe(true);
    });
});

/* ================================================================== */
/*  validateTransactionData                                            */
/* ================================================================== */
describe("validateTransactionData", () => {
    const validData = {
        transaction_id: "tx-1",
        student_id: "stu-1",
        xp_delta: 10,
        gold_delta: 0,
        hearts_delta: 0,
        source_type: "MANUAL_ADJUSTMENT",
        created_at: "2026-01-01T00:00:00.000Z",
        created_by: "teacher-1",
        created_by_role: "TEACHER",
    };

    it("returns valid for complete valid data", () => {
        expect(validateTransactionData(validData).valid).toBe(true);
    });

    it("returns invalid when transaction_id is empty", () => {
        expect(validateTransactionData({ ...validData, transaction_id: "" }).valid).toBe(false);
    });

    it("returns invalid when student_id is missing", () => {
        expect(validateTransactionData({ ...validData, student_id: undefined }).valid).toBe(false);
    });

    it("returns invalid when all deltas are zero", () => {
        expect(
            validateTransactionData({ ...validData, xp_delta: 0 }).valid
        ).toBe(false);
    });

    it("returns invalid for bad source_type", () => {
        expect(
            validateTransactionData({ ...validData, source_type: "NOPE" }).valid
        ).toBe(false);
    });

    it("returns invalid when created_at is missing", () => {
        expect(
            validateTransactionData({ ...validData, created_at: undefined }).valid
        ).toBe(false);
    });

    it("returns invalid when created_by is missing", () => {
        expect(
            validateTransactionData({ ...validData, created_by: undefined }).valid
        ).toBe(false);
    });

    it("returns invalid for bad created_by_role", () => {
        expect(
            validateTransactionData({ ...validData, created_by_role: "GOD" }).valid
        ).toBe(false);
    });

    it("validates source linkage for QUEST_QUESTION", () => {
        expect(
            validateTransactionData({
                ...validData,
                source_type: "QUEST_QUESTION",
                // missing quest_instance_id and question_id
            }).valid
        ).toBe(false);
    });

    it("accepts absent created_by_role (optional)", () => {
        const data = { ...validData };
        delete (data as any).created_by_role;
        expect(validateTransactionData(data).valid).toBe(true);
    });
});

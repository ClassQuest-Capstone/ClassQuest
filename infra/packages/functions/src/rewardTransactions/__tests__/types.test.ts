import { describe, it, expect } from "vitest";
import { computeGSIKeys, generateDeterministicTransactionId, SourceType } from "../types.ts";

/* ================================================================== */
/*  computeGSIKeys                                                     */
/* ================================================================== */
describe("computeGSIKeys", () => {
    const base = {
        student_id: "stu-1",
        source_type: SourceType.QUEST_QUESTION,
        created_at: "2026-01-01T00:00:00.000Z",
        transaction_id: "tx-1",
    };

    it("always sets gsi1_pk and gsi1_sk", () => {
        const keys = computeGSIKeys(base);
        expect(keys.gsi1_pk).toBe("S#stu-1");
        expect(keys.gsi1_sk).toBe("T#2026-01-01T00:00:00.000Z#TX#tx-1");
    });

    it("sets gsi2 keys when class_id is provided", () => {
        const keys = computeGSIKeys({ ...base, class_id: "class-1" });
        expect(keys.gsi2_pk).toBe("C#class-1#S#stu-1");
        expect(keys.gsi2_sk).toBe("T#2026-01-01T00:00:00.000Z#TX#tx-1");
    });

    it("does not set gsi2 keys when class_id is absent", () => {
        const keys = computeGSIKeys(base);
        expect(keys.gsi2_pk).toBeUndefined();
        expect(keys.gsi2_sk).toBeUndefined();
    });

    it("sets gsi3 keys when source_id is provided", () => {
        const keys = computeGSIKeys({ ...base, source_id: "qi-1" });
        expect(keys.gsi3_pk).toBe("SRC#QUEST_QUESTION#qi-1");
        expect(keys.gsi3_sk).toBe("T#2026-01-01T00:00:00.000Z#S#stu-1#TX#tx-1");
    });

    it("does not set gsi3 keys when source_id is absent", () => {
        const keys = computeGSIKeys(base);
        expect(keys.gsi3_pk).toBeUndefined();
        expect(keys.gsi3_sk).toBeUndefined();
    });

    it("sets all GSI keys when class_id and source_id both provided", () => {
        const keys = computeGSIKeys({ ...base, class_id: "c-1", source_id: "src-1" });
        expect(keys.gsi1_pk).toBeDefined();
        expect(keys.gsi2_pk).toBeDefined();
        expect(keys.gsi3_pk).toBeDefined();
    });
});

/* ================================================================== */
/*  generateDeterministicTransactionId                                 */
/* ================================================================== */
describe("generateDeterministicTransactionId", () => {
    it("generates QUESTQ# id for QUEST_QUESTION", () => {
        const id = generateDeterministicTransactionId(
            SourceType.QUEST_QUESTION, "qi-1", "stu-1", "q-1"
        );
        expect(id).toBe("QUESTQ#qi-1#stu-1#q-1");
    });

    it("generates BOSS# id for BOSS_BATTLE", () => {
        const id = generateDeterministicTransactionId(
            SourceType.BOSS_BATTLE, undefined, "stu-1", undefined, "bb-1"
        );
        expect(id).toBe("BOSS#bb-1#stu-1");
    });

    it("throws for unsupported source_type", () => {
        expect(() =>
            generateDeterministicTransactionId(SourceType.MANUAL_ADJUSTMENT)
        ).toThrow("Cannot generate deterministic ID");
    });

    it("throws for QUEST_QUESTION with missing fields", () => {
        expect(() =>
            generateDeterministicTransactionId(SourceType.QUEST_QUESTION, "qi-1", "stu-1")
        ).toThrow();
    });

    it("throws for BOSS_BATTLE with missing fields", () => {
        expect(() =>
            generateDeterministicTransactionId(SourceType.BOSS_BATTLE)
        ).toThrow();
    });
});

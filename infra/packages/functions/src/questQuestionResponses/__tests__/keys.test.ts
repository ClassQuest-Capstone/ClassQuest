/**
 * Unit tests for questQuestionResponses/keys.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questQuestionResponses
 */
import { describe, it, expect } from "vitest";
import {
    makeInstanceStudentPk,
    makeGsi1Sk,
    makeGsi2Sk,
    makeGsi3Sk,
} from "../keys.js";

describe("makeInstanceStudentPk", () => {
    it("concatenates quest_instance_id and student_id with #", () => {
        expect(makeInstanceStudentPk("qi-123", "s-456")).toBe("qi-123#s-456");
    });

    it("handles arbitrary string values", () => {
        expect(makeInstanceStudentPk("a", "b")).toBe("a#b");
    });
});

describe("makeGsi1Sk", () => {
    it("concatenates submitted_at#student_id#question_id", () => {
        expect(makeGsi1Sk("2024-01-01T00:00:00.000Z", "s-1", "q-1"))
            .toBe("2024-01-01T00:00:00.000Z#s-1#q-1");
    });
});

describe("makeGsi2Sk", () => {
    it("concatenates submitted_at#quest_instance_id#question_id", () => {
        expect(makeGsi2Sk("2024-01-01T00:00:00.000Z", "qi-1", "q-1"))
            .toBe("2024-01-01T00:00:00.000Z#qi-1#q-1");
    });
});

describe("makeGsi3Sk", () => {
    it("concatenates submitted_at#student_id#quest_instance_id", () => {
        expect(makeGsi3Sk("2024-01-01T00:00:00.000Z", "s-1", "qi-1"))
            .toBe("2024-01-01T00:00:00.000Z#s-1#qi-1");
    });
});

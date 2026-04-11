import { describe, it, expect } from "vitest";
import { validateCreateInput, validateUpdateInput } from "../validation.ts";

/* ================================================================== */
/*  validateCreateInput                                                */
/* ================================================================== */
describe("validateCreateInput", () => {
    const validBody = {
        class_id: "class-1",
        title: "Copper Helmet",
        description: "A sturdy copper helmet.",
        unlock_level: 5,
        type: "HELMET",
    };

    it("returns no errors for valid input", () => {
        expect(validateCreateInput(validBody)).toEqual([]);
    });

    it("returns error for missing class_id", () => {
        const errors = validateCreateInput({ ...validBody, class_id: undefined });
        expect(errors.some(e => e.field === "class_id")).toBe(true);
    });

    it("returns error for missing title", () => {
        const errors = validateCreateInput({ ...validBody, title: undefined });
        expect(errors.some(e => e.field === "title")).toBe(true);
    });

    it("returns error for empty title", () => {
        const errors = validateCreateInput({ ...validBody, title: "" });
        expect(errors.some(e => e.field === "title")).toBe(true);
    });

    it("returns error for missing description", () => {
        const errors = validateCreateInput({ ...validBody, description: undefined });
        expect(errors.some(e => e.field === "description")).toBe(true);
    });

    it("returns error for missing unlock_level", () => {
        const errors = validateCreateInput({ ...validBody, unlock_level: undefined });
        expect(errors.some(e => e.field === "unlock_level")).toBe(true);
    });

    it("returns error for missing type", () => {
        const errors = validateCreateInput({ ...validBody, type: undefined });
        expect(errors.some(e => e.field === "type")).toBe(true);
    });

    it("returns error for title over 100 characters", () => {
        const errors = validateCreateInput({ ...validBody, title: "x".repeat(101) });
        expect(errors.some(e => e.field === "title" && e.message.includes("1-100"))).toBe(true);
    });

    it("returns error for description over 300 characters", () => {
        const errors = validateCreateInput({ ...validBody, description: "x".repeat(301) });
        expect(errors.some(e => e.field === "description" && e.message.includes("1-300"))).toBe(true);
    });

    it("returns error for unlock_level < 1", () => {
        const errors = validateCreateInput({ ...validBody, unlock_level: 0 });
        expect(errors.some(e => e.field === "unlock_level")).toBe(true);
    });

    it("returns error for non-integer unlock_level", () => {
        const errors = validateCreateInput({ ...validBody, unlock_level: 2.5 });
        expect(errors.some(e => e.field === "unlock_level")).toBe(true);
    });

    it("returns error for invalid type", () => {
        const errors = validateCreateInput({ ...validBody, type: "INVALID" });
        expect(errors.some(e => e.field === "type")).toBe(true);
    });

    it("returns error for invalid reward_target_type", () => {
        const errors = validateCreateInput({ ...validBody, reward_target_type: "NOPE" });
        expect(errors.some(e => e.field === "reward_target_type")).toBe(true);
    });

    it("accepts valid reward_target_type", () => {
        const errors = validateCreateInput({ ...validBody, reward_target_type: "ITEM" });
        expect(errors.some(e => e.field === "reward_target_type")).toBe(false);
    });
});

/* ================================================================== */
/*  validateUpdateInput                                                */
/* ================================================================== */
describe("validateUpdateInput", () => {
    it("returns no errors for empty body (no fields to validate)", () => {
        expect(validateUpdateInput({})).toEqual([]);
    });

    it("returns no errors for valid partial update", () => {
        const errors = validateUpdateInput({ title: "New Title", unlock_level: 10 });
        expect(errors).toEqual([]);
    });

    it("returns error for non-string title", () => {
        const errors = validateUpdateInput({ title: 123 });
        expect(errors.some(e => e.field === "title")).toBe(true);
    });

    it("returns error for empty title", () => {
        const errors = validateUpdateInput({ title: "" });
        expect(errors.some(e => e.field === "title")).toBe(true);
    });

    it("returns error for title over 100 characters", () => {
        const errors = validateUpdateInput({ title: "x".repeat(101) });
        expect(errors.some(e => e.field === "title")).toBe(true);
    });

    it("returns error for non-string description", () => {
        const errors = validateUpdateInput({ description: 42 });
        expect(errors.some(e => e.field === "description")).toBe(true);
    });

    it("returns error for description over 300 characters", () => {
        const errors = validateUpdateInput({ description: "x".repeat(301) });
        expect(errors.some(e => e.field === "description")).toBe(true);
    });

    it("returns error for unlock_level < 1", () => {
        const errors = validateUpdateInput({ unlock_level: 0 });
        expect(errors.some(e => e.field === "unlock_level")).toBe(true);
    });

    it("returns error for invalid type", () => {
        const errors = validateUpdateInput({ type: "LASER" });
        expect(errors.some(e => e.field === "type")).toBe(true);
    });

    it("returns error for invalid reward_target_type", () => {
        const errors = validateUpdateInput({ reward_target_type: "NOPE" });
        expect(errors.some(e => e.field === "reward_target_type")).toBe(true);
    });
});

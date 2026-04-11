import { describe, it, expect } from "vitest";
import { validatePassword, validateUsername } from "../validation.ts";

/* ================================================================== */
/*  validatePassword                                                   */
/* ================================================================== */
describe("validatePassword", () => {
    it("returns no errors for valid password", () => {
        expect(validatePassword("Str0ng!")).toEqual([]);
    });

    it("returns error when password is undefined", () => {
        const errors = validatePassword(undefined);
        expect(errors.some(e => e.field === "password" && e.error === "required")).toBe(true);
    });

    it("returns error when password is null", () => {
        expect(validatePassword(null).some(e => e.error === "required")).toBe(true);
    });

    it("returns error when password is not a string", () => {
        expect(validatePassword(12345).some(e => e.error === "must be a string")).toBe(true);
    });

    it("returns error when password is shorter than 6 chars", () => {
        expect(validatePassword("Ab1!").some(e => e.error.includes("at least 6"))).toBe(true);
    });

    it("returns error when password exceeds 256 chars", () => {
        expect(validatePassword("a".repeat(257)).some(e => e.error.includes("at most 256"))).toBe(true);
    });

    it("accepts exactly 6 characters", () => {
        expect(validatePassword("abcdef")).toEqual([]);
    });

    it("accepts exactly 256 characters", () => {
        expect(validatePassword("a".repeat(256))).toEqual([]);
    });
});

/* ================================================================== */
/*  validateUsername                                                    */
/* ================================================================== */
describe("validateUsername", () => {
    it("returns no errors for valid username", () => {
        expect(validateUsername("player_1")).toEqual([]);
    });

    it("returns error when username is undefined", () => {
        expect(validateUsername(undefined).some(e => e.error === "required")).toBe(true);
    });

    it("returns error when username is null", () => {
        expect(validateUsername(null).some(e => e.error === "required")).toBe(true);
    });

    it("returns error when username is not a string", () => {
        expect(validateUsername(42).some(e => e.error === "must be a string")).toBe(true);
    });

    it("returns error when username is shorter than 3 chars", () => {
        expect(validateUsername("ab").some(e => e.error.includes("at least 3"))).toBe(true);
    });

    it("returns error when username exceeds 50 chars", () => {
        expect(validateUsername("a".repeat(51)).some(e => e.error.includes("at most 50"))).toBe(true);
    });

    it("returns error for special characters", () => {
        expect(validateUsername("user@name").some(e => e.error.includes("letters, numbers"))).toBe(true);
    });

    it("returns error for spaces", () => {
        expect(validateUsername("user name").some(e => e.error.includes("letters, numbers"))).toBe(true);
    });

    it("accepts underscores", () => {
        expect(validateUsername("my_user_123")).toEqual([]);
    });

    it("accepts exactly 3 characters", () => {
        expect(validateUsername("abc")).toEqual([]);
    });

    it("accepts exactly 50 characters", () => {
        expect(validateUsername("a".repeat(50))).toEqual([]);
    });
});

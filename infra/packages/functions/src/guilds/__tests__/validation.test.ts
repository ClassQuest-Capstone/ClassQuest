/**
 * Unit tests for guilds/validation.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/guilds
 */
import { describe, it, expect } from "vitest";
import { validateGuildName, validateGuildPatch } from "../validation.ts";

// ---------------------------------------------------------------------------
// validateGuildName
// ---------------------------------------------------------------------------
describe("validateGuildName", () => {
    it("returns no errors for a valid name", () => {
        expect(validateGuildName("Dragon Squad")).toEqual([]);
    });

    it("returns error when name is undefined", () => {
        const errs = validateGuildName(undefined);
        expect(errs).toHaveLength(1);
        expect(errs[0].field).toBe("name");
        expect(errs[0].error).toContain("required");
    });

    it("returns error when name is null", () => {
        const errs = validateGuildName(null);
        expect(errs[0].error).toContain("required");
    });

    it("returns error when name is not a string", () => {
        const errs = validateGuildName(42);
        expect(errs[0].field).toBe("name");
        expect(errs[0].error).toContain("string");
    });

    it("returns error when name is empty string", () => {
        const errs = validateGuildName("");
        expect(errs[0].error).toContain("empty");
    });

    it("returns error when name is whitespace only", () => {
        const errs = validateGuildName("   ");
        expect(errs[0].error).toContain("empty");
    });
});

// ---------------------------------------------------------------------------
// validateGuildPatch
// ---------------------------------------------------------------------------
describe("validateGuildPatch", () => {
    it("returns no errors for an empty patch (nothing to validate)", () => {
        expect(validateGuildPatch({})).toEqual([]);
    });

    it("returns no errors for a valid name patch", () => {
        expect(validateGuildPatch({ name: "Phoenix" })).toEqual([]);
    });

    it("returns no errors for a valid is_active patch", () => {
        expect(validateGuildPatch({ is_active: false })).toEqual([]);
    });

    it("returns no errors for a valid combined patch", () => {
        expect(validateGuildPatch({ name: "Phoenix", is_active: true })).toEqual([]);
    });

    it("returns error when name is an empty string", () => {
        const errs = validateGuildPatch({ name: "" });
        expect(errs.some((e) => e.field === "name")).toBe(true);
    });

    it("returns error when name is whitespace", () => {
        const errs = validateGuildPatch({ name: "   " });
        expect(errs.some((e) => e.field === "name")).toBe(true);
    });

    it("returns error when is_active is not a boolean", () => {
        const errs = validateGuildPatch({ is_active: "yes" });
        expect(errs[0].field).toBe("is_active");
        expect(errs[0].error).toContain("boolean");
    });

    it("returns error when is_active is a number", () => {
        const errs = validateGuildPatch({ is_active: 1 });
        expect(errs[0].field).toBe("is_active");
    });
});

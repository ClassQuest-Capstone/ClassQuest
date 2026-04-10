/**
 * Unit tests for guildMemberships/validation.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/guildMemberships
 */
import { describe, it, expect } from "vitest";
import {
    validateGuildId,
    validateRole,
    validateUpsertMembership,
} from "../validation.ts";

// ---------------------------------------------------------------------------
// validateGuildId
// ---------------------------------------------------------------------------
describe("validateGuildId", () => {
    it("returns no errors for a valid guild_id", () => {
        expect(validateGuildId("guild-1")).toEqual([]);
    });

    it("returns error when guild_id is undefined", () => {
        const errs = validateGuildId(undefined);
        expect(errs).toHaveLength(1);
        expect(errs[0].field).toBe("guild_id");
        expect(errs[0].error).toContain("required");
    });

    it("returns error when guild_id is null", () => {
        const errs = validateGuildId(null);
        expect(errs[0].error).toContain("required");
    });

    it("returns error when guild_id is not a string", () => {
        const errs = validateGuildId(42);
        expect(errs[0].error).toContain("string");
    });

    it("returns error when guild_id is an empty string", () => {
        const errs = validateGuildId("");
        expect(errs[0].error).toContain("empty");
    });

    it("returns error when guild_id is whitespace only", () => {
        const errs = validateGuildId("   ");
        expect(errs[0].error).toContain("empty");
    });
});

// ---------------------------------------------------------------------------
// validateRole
// ---------------------------------------------------------------------------
describe("validateRole", () => {
    it("returns no errors when role_in_guild is undefined (optional)", () => {
        expect(validateRole(undefined)).toEqual([]);
    });

    it("returns no errors when role_in_guild is null (optional)", () => {
        expect(validateRole(null)).toEqual([]);
    });

    it("returns no errors for LEADER", () => {
        expect(validateRole("LEADER")).toEqual([]);
    });

    it("returns no errors for MEMBER", () => {
        expect(validateRole("MEMBER")).toEqual([]);
    });

    it("returns error when role_in_guild is not a string", () => {
        const errs = validateRole(123);
        expect(errs[0].field).toBe("role_in_guild");
        expect(errs[0].error).toContain("string");
    });

    it("returns error when role_in_guild is an invalid value", () => {
        const errs = validateRole("ADMIN");
        expect(errs[0].field).toBe("role_in_guild");
        expect(errs[0].error).toContain("LEADER");
        expect(errs[0].error).toContain("MEMBER");
    });
});

// ---------------------------------------------------------------------------
// validateUpsertMembership
// ---------------------------------------------------------------------------
describe("validateUpsertMembership", () => {
    it("returns no errors for valid input with guild_id only", () => {
        expect(validateUpsertMembership({ guild_id: "guild-1" })).toEqual([]);
    });

    it("returns no errors for valid input with guild_id and role", () => {
        expect(
            validateUpsertMembership({ guild_id: "guild-1", role_in_guild: "LEADER" })
        ).toEqual([]);
    });

    it("returns error when guild_id is missing", () => {
        const errs = validateUpsertMembership({});
        expect(errs.some((e) => e.field === "guild_id")).toBe(true);
    });

    it("returns error when role_in_guild is invalid", () => {
        const errs = validateUpsertMembership({
            guild_id: "guild-1",
            role_in_guild: "INVALID",
        });
        expect(errs.some((e) => e.field === "role_in_guild")).toBe(true);
    });

    it("accumulates multiple errors", () => {
        const errs = validateUpsertMembership({
            guild_id: null,
            role_in_guild: 99,
        });
        expect(errs.length).toBeGreaterThanOrEqual(2);
    });
});

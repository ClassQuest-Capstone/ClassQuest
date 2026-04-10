/**
 * Unit tests for guildMemberships/keys.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/guildMemberships
 */
import { describe, it, expect } from "vitest";
import { makeGsi1Sk, makeGsi2Sk } from "../keys.ts";

const TS = "2026-04-10T00:00:00.000Z";

describe("makeGsi1Sk", () => {
    it("formats as joined_at#student_id", () => {
        expect(makeGsi1Sk(TS, "student-1")).toBe(`${TS}#student-1`);
    });

    it("is deterministic for the same inputs", () => {
        expect(makeGsi1Sk(TS, "s-abc")).toBe(makeGsi1Sk(TS, "s-abc"));
    });

    it("different timestamps produce different keys", () => {
        const ts2 = "2026-05-01T00:00:00.000Z";
        expect(makeGsi1Sk(TS, "s-1")).not.toBe(makeGsi1Sk(ts2, "s-1"));
    });

    it("different student_ids produce different keys", () => {
        expect(makeGsi1Sk(TS, "s-1")).not.toBe(makeGsi1Sk(TS, "s-2"));
    });
});

describe("makeGsi2Sk", () => {
    it("formats as joined_at#class_id#guild_id", () => {
        expect(makeGsi2Sk(TS, "class-1", "guild-1")).toBe(`${TS}#class-1#guild-1`);
    });

    it("is deterministic for the same inputs", () => {
        expect(makeGsi2Sk(TS, "c-1", "g-1")).toBe(makeGsi2Sk(TS, "c-1", "g-1"));
    });

    it("different class_ids produce different keys", () => {
        expect(makeGsi2Sk(TS, "c-1", "g-1")).not.toBe(makeGsi2Sk(TS, "c-2", "g-1"));
    });

    it("different guild_ids produce different keys", () => {
        expect(makeGsi2Sk(TS, "c-1", "g-1")).not.toBe(makeGsi2Sk(TS, "c-1", "g-2"));
    });
});

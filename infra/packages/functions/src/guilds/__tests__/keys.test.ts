/**
 * Unit tests for guilds/keys.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/guilds
 */
import { describe, it, expect } from "vitest";
import { makeGsi1Sk } from "../keys.ts";

const TS = "2026-04-10T00:00:00.000Z";

describe("makeGsi1Sk", () => {
    it("formats as created_at#guild_id", () => {
        expect(makeGsi1Sk(TS, "guild-1")).toBe(`${TS}#guild-1`);
    });

    it("is deterministic for the same inputs", () => {
        expect(makeGsi1Sk(TS, "guild-abc")).toBe(makeGsi1Sk(TS, "guild-abc"));
    });

    it("different timestamps produce different keys", () => {
        const ts2 = "2026-05-01T00:00:00.000Z";
        expect(makeGsi1Sk(TS, "guild-1")).not.toBe(makeGsi1Sk(ts2, "guild-1"));
    });

    it("different guild_ids produce different keys", () => {
        expect(makeGsi1Sk(TS, "guild-1")).not.toBe(makeGsi1Sk(TS, "guild-2"));
    });
});

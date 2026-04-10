/**
 * Unit tests for bossBattleTemplates/keys.ts
 *
 * Pure function — no mocks needed.
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/bossBattleTemplates
 */
import { describe, it, expect } from "vitest";
import { makePublicSort } from "../keys.ts";

describe("makePublicSort", () => {
    it("produces SUBJECT#timestamp#id when subject is provided", () => {
        const result = makePublicSort("MATH", "2024-01-15T10:00:00Z", "abc-123");
        expect(result).toBe("MATH#2024-01-15T10:00:00Z#abc-123");
    });

    it("uses UNSPECIFIED when subject is undefined", () => {
        const result = makePublicSort(undefined, "2024-01-15T10:00:00Z", "abc-123");
        expect(result).toBe("UNSPECIFIED#2024-01-15T10:00:00Z#abc-123");
    });

    it("uses UNSPECIFIED when subject is empty string", () => {
        const result = makePublicSort("", "2024-01-15T10:00:00Z", "abc-123");
        expect(result).toBe("UNSPECIFIED#2024-01-15T10:00:00Z#abc-123");
    });

    it("preserves subject casing exactly", () => {
        const result = makePublicSort("science", "2024-01-15T10:00:00Z", "abc-123");
        expect(result).toBe("science#2024-01-15T10:00:00Z#abc-123");
    });

    it("result starts with subject when provided", () => {
        const result = makePublicSort("HISTORY", "2024-01-15T10:00:00Z", "id-1");
        expect(result.startsWith("HISTORY#")).toBe(true);
    });

    it("result ends with the boss_template_id", () => {
        const result = makePublicSort("MATH", "2024-01-15T10:00:00Z", "my-id");
        expect(result.endsWith("#my-id")).toBe(true);
    });

    it("different subjects produce different sort keys", () => {
        const a = makePublicSort("MATH", "2024-01-15T10:00:00Z", "id-1");
        const b = makePublicSort("SCIENCE", "2024-01-15T10:00:00Z", "id-1");
        expect(a).not.toBe(b);
    });

    it("same inputs always produce the same output", () => {
        const r1 = makePublicSort("MATH", "2024-01-15T10:00:00Z", "id-1");
        const r2 = makePublicSort("MATH", "2024-01-15T10:00:00Z", "id-1");
        expect(r1).toBe(r2);
    });
});

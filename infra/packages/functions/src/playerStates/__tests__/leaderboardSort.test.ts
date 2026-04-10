/**
 * Unit tests for playerStates/leaderboardSort.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/playerStates
 */
import { describe, it, expect } from "vitest";
import { makeLeaderboardSort } from "../leaderboardSort.js";

describe("makeLeaderboardSort", () => {
    it("returns a string in the format {inverted_xp}#{student_id}", () => {
        const result = makeLeaderboardSort(0, "student-1");
        expect(result).toMatch(/^\d{10}#student-1$/);
    });

    it("uses MAX_XP = 1,000,000,000 for inversion", () => {
        const result = makeLeaderboardSort(0, "s1");
        // 1_000_000_000 - 0 = 1_000_000_000, padded to 10 digits
        expect(result).toBe("1000000000#s1");
    });

    it("returns 0000000000 prefix when xp equals MAX_XP", () => {
        const result = makeLeaderboardSort(1_000_000_000, "s1");
        expect(result).toBe("0000000000#s1");
    });

    it("pads inverted xp to 10 digits", () => {
        const result = makeLeaderboardSort(999_999_999, "s1");
        // 1_000_000_000 - 999_999_999 = 1, padded to 10 digits
        expect(result).toBe("0000000001#s1");
    });

    it("higher XP produces lexicographically smaller sort key", () => {
        const highXp = makeLeaderboardSort(500, "s1");
        const lowXp  = makeLeaderboardSort(100, "s1");
        expect(highXp < lowXp).toBe(true);
    });

    it("same XP breaks ties by student_id", () => {
        const a = makeLeaderboardSort(100, "student-a");
        const b = makeLeaderboardSort(100, "student-b");
        // student-a < student-b lexicographically
        expect(a < b).toBe(true);
    });

    it("includes the student_id exactly as provided", () => {
        const result = makeLeaderboardSort(42, "my-student-uuid-123");
        expect(result.endsWith("#my-student-uuid-123")).toBe(true);
    });

    it("computes correct inverted value for arbitrary xp", () => {
        const xp = 1_000;
        const result = makeLeaderboardSort(xp, "s1");
        const expected = (1_000_000_000 - xp).toString().padStart(10, "0") + "#s1";
        expect(result).toBe(expected);
    });
});

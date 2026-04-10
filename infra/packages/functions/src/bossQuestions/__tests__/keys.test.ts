/**
 * Unit tests for bossQuestions/keys.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/bossQuestions
 */
import { describe, it, expect } from "vitest";
import { makeOrderKey } from "../keys.ts";

describe("makeOrderKey", () => {
    it("pads 0 to '000000'", () => {
        expect(makeOrderKey(0)).toBe("000000");
    });

    it("pads single digit to 6 characters", () => {
        expect(makeOrderKey(1)).toBe("000001");
    });

    it("pads 42 to '000042'", () => {
        expect(makeOrderKey(42)).toBe("000042");
    });

    it("pads 9999 to '009999'", () => {
        expect(makeOrderKey(9999)).toBe("009999");
    });

    it("accepts 999999 as max value", () => {
        expect(makeOrderKey(999999)).toBe("999999");
    });

    it("throws on negative order_index", () => {
        expect(() => makeOrderKey(-1)).toThrow("order_index must be non-negative");
    });

    it("throws when order_index exceeds 999999", () => {
        expect(() => makeOrderKey(1000000)).toThrow("order_index must be <= 999999");
    });

    it("is deterministic for the same input", () => {
        expect(makeOrderKey(7)).toBe(makeOrderKey(7));
    });
});

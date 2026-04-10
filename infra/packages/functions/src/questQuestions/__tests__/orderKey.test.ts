/**
 * Unit tests for questQuestions/orderKey.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questQuestions
 */
import { describe, it, expect } from "vitest";
import { toOrderKey } from "../orderKey.ts";

describe("toOrderKey", () => {
    it("pads 1 to '0001'", () => {
        expect(toOrderKey(1)).toBe("0001");
    });

    it("pads 0 to '0000'", () => {
        expect(toOrderKey(0)).toBe("0000");
    });

    it("pads 42 to '0042'", () => {
        expect(toOrderKey(42)).toBe("0042");
    });

    it("pads 999 to '0999'", () => {
        expect(toOrderKey(999)).toBe("0999");
    });

    it("returns '9999' for 9999 (max)", () => {
        expect(toOrderKey(9999)).toBe("9999");
    });

    it("throws for negative order_index", () => {
        expect(() => toOrderKey(-1)).toThrow("non-negative");
    });

    it("throws for order_index > 9999", () => {
        expect(() => toOrderKey(10000)).toThrow("<= 9999");
    });

    it("produces lexicographic ordering consistent with numeric ordering", () => {
        const keys = [toOrderKey(3), toOrderKey(10), toOrderKey(1), toOrderKey(100)];
        const sorted = [...keys].sort();
        expect(sorted).toEqual([toOrderKey(1), toOrderKey(3), toOrderKey(10), toOrderKey(100)]);
    });
});

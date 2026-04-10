/**
 * Unit tests for playerStates/validation.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/playerStates
 */
import { describe, it, expect } from "vitest";
import { validatePlayerState } from "../validation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validData(overrides: Record<string, any> = {}) {
    return {
        current_xp:        100,
        xp_to_next_level:  500,
        total_xp_earned:   100,
        hearts:            3,
        max_hearts:        5,
        gold:              50,
        status:            "ALIVE",
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Valid input
// ---------------------------------------------------------------------------
describe("valid input", () => {
    it("returns empty array for fully valid input", () => {
        expect(validatePlayerState(validData())).toEqual([]);
    });

    it("returns empty array when optional fields are absent", () => {
        expect(validatePlayerState(validData())).toEqual([]);
    });

    it("accepts heart_regen_interval_hours as a positive number", () => {
        expect(validatePlayerState(validData({ heart_regen_interval_hours: 3 }))).toEqual([]);
    });

    it("accepts heart_regen_enabled as boolean false", () => {
        expect(validatePlayerState(validData({ heart_regen_enabled: false }))).toEqual([]);
    });

    it("accepts last_weekend_reset_at as a valid ISO string", () => {
        expect(validatePlayerState(validData({ last_weekend_reset_at: "2024-01-01T00:00:00.000Z" }))).toEqual([]);
    });

    it("accepts status DOWNED", () => {
        expect(validatePlayerState(validData({ status: "DOWNED" }))).toEqual([]);
    });

    it("accepts status BANNED", () => {
        expect(validatePlayerState(validData({ status: "BANNED" }))).toEqual([]);
    });

    it("accepts hearts equal to max_hearts", () => {
        expect(validatePlayerState(validData({ hearts: 5, max_hearts: 5 }))).toEqual([]);
    });

    it("accepts zero values for all numeric fields", () => {
        expect(validatePlayerState(validData({ current_xp: 0, xp_to_next_level: 0, total_xp_earned: 0, hearts: 0, max_hearts: 0, gold: 0 }))).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Required field validation
// ---------------------------------------------------------------------------
describe("required fields", () => {
    const requiredFields = ["current_xp", "xp_to_next_level", "total_xp_earned", "hearts", "max_hearts", "gold", "status"];

    for (const field of requiredFields) {
        it(`returns error when ${field} is missing`, () => {
            const data = validData({ [field]: undefined });
            const errors = validatePlayerState(data);
            expect(errors.some(e => e.field === field && e.error === "required")).toBe(true);
        });

        it(`returns error when ${field} is null`, () => {
            const data = validData({ [field]: null });
            const errors = validatePlayerState(data);
            expect(errors.some(e => e.field === field && e.error === "required")).toBe(true);
        });
    }
});

// ---------------------------------------------------------------------------
// Number field type validation
// ---------------------------------------------------------------------------
describe("number field type validation", () => {
    const numberFields = ["current_xp", "xp_to_next_level", "total_xp_earned", "hearts", "max_hearts", "gold"];

    for (const field of numberFields) {
        it(`returns type error when ${field} is a string`, () => {
            const errors = validatePlayerState(validData({ [field]: "100" }));
            expect(errors.some(e => e.field === field && e.error === "must be a number")).toBe(true);
        });
    }
});

// ---------------------------------------------------------------------------
// Non-negative validation
// ---------------------------------------------------------------------------
describe("non-negative validation", () => {
    const numberFields = ["current_xp", "xp_to_next_level", "total_xp_earned", "hearts", "max_hearts", "gold"];

    for (const field of numberFields) {
        it(`returns error when ${field} is negative`, () => {
            const errors = validatePlayerState(validData({ [field]: -1 }));
            expect(errors.some(e => e.field === field && e.error === "must be >= 0")).toBe(true);
        });
    }
});

// ---------------------------------------------------------------------------
// hearts <= max_hearts
// ---------------------------------------------------------------------------
describe("hearts <= max_hearts", () => {
    it("returns error when hearts exceeds max_hearts", () => {
        const errors = validatePlayerState(validData({ hearts: 6, max_hearts: 5 }));
        expect(errors.some(e => e.field === "hearts" && e.error === "cannot exceed max_hearts")).toBe(true);
    });

    it("does not return error when hearts equals max_hearts", () => {
        const errors = validatePlayerState(validData({ hearts: 5, max_hearts: 5 }));
        expect(errors.some(e => e.field === "hearts" && e.error === "cannot exceed max_hearts")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Status enum
// ---------------------------------------------------------------------------
describe("status enum", () => {
    it("returns error for invalid status value", () => {
        const errors = validatePlayerState(validData({ status: "UNKNOWN" }));
        expect(errors.some(e => e.field === "status")).toBe(true);
    });

    it("error message lists valid statuses", () => {
        const errors = validatePlayerState(validData({ status: "BAD" }));
        const statusError = errors.find(e => e.field === "status" && e.error.includes("ALIVE"));
        expect(statusError).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------
// Optional field: heart_regen_interval_hours
// ---------------------------------------------------------------------------
describe("heart_regen_interval_hours", () => {
    it("returns error when heart_regen_interval_hours is not a number", () => {
        const errors = validatePlayerState(validData({ heart_regen_interval_hours: "3" }));
        expect(errors.some(e => e.field === "heart_regen_interval_hours")).toBe(true);
    });

    it("returns error when heart_regen_interval_hours is 0", () => {
        const errors = validatePlayerState(validData({ heart_regen_interval_hours: 0 }));
        expect(errors.some(e => e.field === "heart_regen_interval_hours")).toBe(true);
    });

    it("returns error when heart_regen_interval_hours is negative", () => {
        const errors = validatePlayerState(validData({ heart_regen_interval_hours: -1 }));
        expect(errors.some(e => e.field === "heart_regen_interval_hours")).toBe(true);
    });

    it("no error when heart_regen_interval_hours is absent", () => {
        const errors = validatePlayerState(validData());
        expect(errors.some(e => e.field === "heart_regen_interval_hours")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Optional field: heart_regen_enabled
// ---------------------------------------------------------------------------
describe("heart_regen_enabled", () => {
    it("returns error when heart_regen_enabled is not a boolean", () => {
        const errors = validatePlayerState(validData({ heart_regen_enabled: "true" }));
        expect(errors.some(e => e.field === "heart_regen_enabled")).toBe(true);
    });

    it("no error when heart_regen_enabled is absent", () => {
        const errors = validatePlayerState(validData());
        expect(errors.some(e => e.field === "heart_regen_enabled")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Optional field: last_weekend_reset_at
// ---------------------------------------------------------------------------
describe("last_weekend_reset_at", () => {
    it("returns error when last_weekend_reset_at is not a string", () => {
        const errors = validatePlayerState(validData({ last_weekend_reset_at: 12345 }));
        expect(errors.some(e => e.field === "last_weekend_reset_at" && e.error === "must be a string")).toBe(true);
    });

    it("returns error when last_weekend_reset_at is an invalid date string", () => {
        const errors = validatePlayerState(validData({ last_weekend_reset_at: "not-a-date" }));
        expect(errors.some(e => e.field === "last_weekend_reset_at" && e.error.includes("ISO 8601"))).toBe(true);
    });

    it("no error when last_weekend_reset_at is absent", () => {
        const errors = validatePlayerState(validData());
        expect(errors.some(e => e.field === "last_weekend_reset_at")).toBe(false);
    });
});

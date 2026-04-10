/**
 * Unit tests for questQuestions/validation.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questQuestions
 */
import { describe, it, expect } from "vitest";
import {
    normalizeQuestionFormat,
    validateQuestionFormat,
    validateDifficulty,
    validateTimeLimit,
    validateMCQOptions,
    validateMatchingOptions,
    validateOrderingOptions,
    validateFillBlankOptions,
    validateCorrectAnswer,
    validateRewardConfig,
    validateQuestion,
} from "../validation.ts";

// ---------------------------------------------------------------------------
// normalizeQuestionFormat
// ---------------------------------------------------------------------------
describe("normalizeQuestionFormat", () => {
    it("returns question_format when provided", () => {
        expect(normalizeQuestionFormat({ question_format: "MCQ_SINGLE" })).toBe("MCQ_SINGLE");
    });

    it("maps legacy question_type to question_format", () => {
        expect(normalizeQuestionFormat({ question_type: "MCQ" })).toBe("MCQ_SINGLE");
    });

    it("prefers question_format over question_type", () => {
        expect(normalizeQuestionFormat({ question_type: "MCQ", question_format: "TRUE_FALSE" })).toBe("TRUE_FALSE");
    });

    it("returns null when neither provided", () => {
        expect(normalizeQuestionFormat({})).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// validateQuestionFormat
// ---------------------------------------------------------------------------
describe("validateQuestionFormat", () => {
    it("accepts all valid formats", () => {
        const formats = ["MCQ_SINGLE", "MCQ_MULTI", "TRUE_FALSE", "MATCHING", "ORDERING", "FILL_BLANK", "NUMERIC", "SHORT_ANSWER", "ESSAY", "OTHER"];
        for (const f of formats) {
            expect(validateQuestionFormat(f).valid).toBe(true);
        }
    });

    it("rejects an invalid format", () => {
        const result = validateQuestionFormat("MCQ");
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/must be one of/);
    });
});

// ---------------------------------------------------------------------------
// validateDifficulty
// ---------------------------------------------------------------------------
describe("validateDifficulty", () => {
    it("accepts EASY, MEDIUM, HARD", () => {
        for (const d of ["EASY", "MEDIUM", "HARD"]) {
            expect(validateDifficulty(d).valid).toBe(true);
        }
    });

    it("rejects invalid difficulty", () => {
        const result = validateDifficulty("EXTREME");
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/must be one of/);
    });
});

// ---------------------------------------------------------------------------
// validateTimeLimit
// ---------------------------------------------------------------------------
describe("validateTimeLimit", () => {
    it("accepts positive integers", () => {
        expect(validateTimeLimit(30).valid).toBe(true);
    });

    it("rejects 0", () => {
        expect(validateTimeLimit(0).valid).toBe(false);
    });

    it("rejects negative numbers", () => {
        expect(validateTimeLimit(-5).valid).toBe(false);
    });

    it("rejects floats", () => {
        expect(validateTimeLimit(1.5).valid).toBe(false);
        expect(validateTimeLimit(1.5).error).toMatch(/positive integer/);
    });
});

// ---------------------------------------------------------------------------
// validateMCQOptions
// ---------------------------------------------------------------------------
describe("validateMCQOptions", () => {
    const validChoices = [{ id: "a", text: "Yes" }, { id: "b", text: "No" }];

    it("accepts valid MCQ options with 2+ choices", () => {
        expect(validateMCQOptions({ choices: validChoices }).valid).toBe(true);
    });

    it("rejects non-object options", () => {
        expect(validateMCQOptions(null).valid).toBe(false);
        expect(validateMCQOptions("string").valid).toBe(false);
    });

    it("rejects missing choices array", () => {
        expect(validateMCQOptions({}).valid).toBe(false);
        expect(validateMCQOptions({}).error).toMatch(/choices must be an array/);
    });

    it("rejects fewer than 2 choices", () => {
        expect(validateMCQOptions({ choices: [{ id: "a", text: "A" }] }).valid).toBe(false);
    });

    it("rejects choice missing id or text", () => {
        const result = validateMCQOptions({ choices: [{ id: "a" }, { text: "B" }] });
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/id.*text/);
    });

    it("TRUE_FALSE: rejects more than 2 choices (isTrueFalse=true)", () => {
        const threeChoices = [
            { id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }
        ];
        expect(validateMCQOptions({ choices: threeChoices }, true).valid).toBe(false);
    });

    it("TRUE_FALSE: accepts exactly 2 choices", () => {
        expect(validateMCQOptions({ choices: validChoices }, true).valid).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// validateMatchingOptions
// ---------------------------------------------------------------------------
describe("validateMatchingOptions", () => {
    const valid = {
        left: [{ id: "l1", text: "Left 1" }],
        right: [{ id: "r1", text: "Right 1" }],
    };

    it("accepts valid matching options", () => {
        expect(validateMatchingOptions(valid).valid).toBe(true);
    });

    it("rejects non-object", () => {
        expect(validateMatchingOptions(null).valid).toBe(false);
    });

    it("rejects missing left or right arrays", () => {
        expect(validateMatchingOptions({ left: [] }).valid).toBe(false);
    });

    it("rejects empty left array", () => {
        expect(validateMatchingOptions({ left: [], right: [{ id: "r1", text: "R" }] }).valid).toBe(false);
    });

    it("rejects item missing id or text", () => {
        const result = validateMatchingOptions({
            left: [{ id: "l1" }],
            right: [{ id: "r1", text: "R" }],
        });
        expect(result.valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// validateOrderingOptions
// ---------------------------------------------------------------------------
describe("validateOrderingOptions", () => {
    const valid = {
        items: [{ id: "i1", text: "First" }, { id: "i2", text: "Second" }],
    };

    it("accepts valid ordering options", () => {
        expect(validateOrderingOptions(valid).valid).toBe(true);
    });

    it("rejects non-object", () => {
        expect(validateOrderingOptions(null).valid).toBe(false);
    });

    it("rejects missing items array", () => {
        expect(validateOrderingOptions({}).valid).toBe(false);
    });

    it("rejects fewer than 2 items", () => {
        expect(validateOrderingOptions({ items: [{ id: "i1", text: "A" }] }).valid).toBe(false);
    });

    it("rejects item missing id or text", () => {
        const result = validateOrderingOptions({
            items: [{ id: "i1" }, { text: "B" }],
        });
        expect(result.valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// validateFillBlankOptions
// ---------------------------------------------------------------------------
describe("validateFillBlankOptions", () => {
    const valid = { text: "The ___ is blue", blanks: [{ id: "b1" }] };

    it("accepts valid fill-blank options", () => {
        expect(validateFillBlankOptions(valid).valid).toBe(true);
    });

    it("rejects non-object", () => {
        expect(validateFillBlankOptions(null).valid).toBe(false);
    });

    it("rejects missing text", () => {
        expect(validateFillBlankOptions({ blanks: [{ id: "b1" }] }).valid).toBe(false);
    });

    it("rejects non-array blanks", () => {
        expect(validateFillBlankOptions({ text: "T", blanks: {} }).valid).toBe(false);
    });

    it("rejects blank missing id", () => {
        expect(validateFillBlankOptions({ text: "T", blanks: [{}] }).valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// validateCorrectAnswer
// ---------------------------------------------------------------------------
describe("validateCorrectAnswer", () => {
    it("MCQ_SINGLE requires choiceId", () => {
        expect(validateCorrectAnswer("MCQ_SINGLE", { choiceId: "a" }).valid).toBe(true);
        expect(validateCorrectAnswer("MCQ_SINGLE", { choiceIds: ["a"] }).valid).toBe(false);
    });

    it("TRUE_FALSE requires choiceId", () => {
        expect(validateCorrectAnswer("TRUE_FALSE", { choiceId: "true" }).valid).toBe(true);
    });

    it("MCQ_MULTI requires non-empty choiceIds array", () => {
        expect(validateCorrectAnswer("MCQ_MULTI", { choiceIds: ["a", "b"] }).valid).toBe(true);
        expect(validateCorrectAnswer("MCQ_MULTI", { choiceIds: [] }).valid).toBe(false);
    });

    it("MATCHING requires pairs array with leftId+rightId", () => {
        expect(validateCorrectAnswer("MATCHING", {
            pairs: [{ leftId: "l1", rightId: "r1" }]
        }).valid).toBe(true);
        expect(validateCorrectAnswer("MATCHING", { pairs: "nope" }).valid).toBe(false);
    });

    it("ORDERING requires order array", () => {
        expect(validateCorrectAnswer("ORDERING", { order: ["i1", "i2"] }).valid).toBe(true);
        expect(validateCorrectAnswer("ORDERING", { order: "nope" }).valid).toBe(false);
    });

    it("FILL_BLANK requires blanks object", () => {
        expect(validateCorrectAnswer("FILL_BLANK", { blanks: { b1: ["sky"] } }).valid).toBe(true);
        expect(validateCorrectAnswer("FILL_BLANK", { blanks: null }).valid).toBe(false);
    });

    it("NUMERIC requires value or min+max", () => {
        expect(validateCorrectAnswer("NUMERIC", { value: 42 }).valid).toBe(true);
        expect(validateCorrectAnswer("NUMERIC", { min: 1, max: 5 }).valid).toBe(true);
        expect(validateCorrectAnswer("NUMERIC", {}).valid).toBe(false);
    });

    it("rejects null correct_answer", () => {
        expect(validateCorrectAnswer("MCQ_SINGLE", null).valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// validateRewardConfig
// ---------------------------------------------------------------------------
describe("validateRewardConfig", () => {
    it("accepts empty config", () => {
        expect(validateRewardConfig({}).valid).toBe(true);
    });

    it("accepts valid reward fields", () => {
        expect(validateRewardConfig({
            base_xp: 10, min_xp: 2, xp_decay_per_wrong: 1,
            base_gold: 5, min_gold: 1, gold_decay_per_wrong: 0,
        }).valid).toBe(true);
    });

    it("rejects negative base_xp", () => {
        expect(validateRewardConfig({ base_xp: -1 }).valid).toBe(false);
    });

    it("rejects min_xp > base_xp", () => {
        expect(validateRewardConfig({ base_xp: 5, min_xp: 10 }).valid).toBe(false);
    });

    it("rejects negative xp_decay_per_wrong", () => {
        expect(validateRewardConfig({ xp_decay_per_wrong: -1 }).valid).toBe(false);
    });

    it("rejects negative base_gold", () => {
        expect(validateRewardConfig({ base_gold: -1 }).valid).toBe(false);
    });

    it("rejects min_gold > base_gold", () => {
        expect(validateRewardConfig({ base_gold: 2, min_gold: 5 }).valid).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// validateQuestion (composite)
// ---------------------------------------------------------------------------
describe("validateQuestion", () => {
    function baseData(overrides: Record<string, any> = {}) {
        return {
            question_format: "SHORT_ANSWER" as any,
            prompt: "What is 2+2?",
            max_points: 5,
            ...overrides,
        };
    }

    it("accepts valid minimal SHORT_ANSWER question", () => {
        expect(validateQuestion(baseData()).valid).toBe(true);
    });

    it("rejects empty prompt", () => {
        expect(validateQuestion(baseData({ prompt: "" })).valid).toBe(false);
    });

    it("rejects missing max_points", () => {
        const data = baseData();
        delete (data as any).max_points;
        expect(validateQuestion(data as any).valid).toBe(false);
    });

    it("rejects negative max_points", () => {
        expect(validateQuestion(baseData({ max_points: -1 })).valid).toBe(false);
    });

    it("rejects invalid difficulty", () => {
        expect(validateQuestion(baseData({ difficulty: "EXTREME" })).valid).toBe(false);
    });

    it("rejects invalid time_limit_seconds", () => {
        expect(validateQuestion(baseData({ time_limit_seconds: 0 })).valid).toBe(false);
    });

    it("runs MCQ_SINGLE options validation", () => {
        // MCQ_SINGLE without options
        const result = validateQuestion(baseData({
            question_format: "MCQ_SINGLE",
            options: null,
        }));
        expect(result.valid).toBe(false);
    });

    it("validates correct_answer when auto_gradable=true for MCQ_SINGLE", () => {
        const result = validateQuestion(baseData({
            question_format: "MCQ_SINGLE",
            options: { choices: [{ id: "a", text: "A" }, { id: "b", text: "B" }] },
            auto_gradable: true,
            correct_answer: null,
        }));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/correct_answer/);
    });

    it("skips correct_answer check when auto_gradable=false", () => {
        const result = validateQuestion(baseData({
            question_format: "MCQ_SINGLE",
            options: { choices: [{ id: "a", text: "A" }, { id: "b", text: "B" }] },
            auto_gradable: false,
        }));
        expect(result.valid).toBe(true);
    });
});

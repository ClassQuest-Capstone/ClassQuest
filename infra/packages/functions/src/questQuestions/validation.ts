import type {
    QuestionFormat,
    QuestionType,
    Difficulty,
    MCQOptions,
    MatchingOptions,
    OrderingOptions,
    FillBlankOptions,
} from "./types.ts";
import { mapLegacyTypeToFormat } from "./types.ts";

const VALID_QUESTION_FORMATS: QuestionFormat[] = [
    "MCQ_SINGLE",
    "MCQ_MULTI",
    "TRUE_FALSE",
    "MATCHING",
    "ORDERING",
    "FILL_BLANK",
    "NUMERIC",
    "SHORT_ANSWER",
    "ESSAY",
    "OTHER",
];

const VALID_DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

const AUTO_GRADABLE_FORMATS: QuestionFormat[] = [
    "MCQ_SINGLE",
    "MCQ_MULTI",
    "TRUE_FALSE",
    "MATCHING",
    "ORDERING",
    "FILL_BLANK",
    "NUMERIC",
];

/**
 * Normalize question_type or question_format into question_format
 */
export function normalizeQuestionFormat(body: {
    question_type?: QuestionType;
    question_format?: QuestionFormat;
}): QuestionFormat | null {
    if (body.question_format) {
        return body.question_format;
    }
    if (body.question_type) {
        return mapLegacyTypeToFormat(body.question_type);
    }
    return null;
}

/**
 * Validate question format
 */
export function validateQuestionFormat(question_format: string): {
    valid: boolean;
    error?: string;
} {
    if (!VALID_QUESTION_FORMATS.includes(question_format as QuestionFormat)) {
        return {
            valid: false,
            error: `question_format must be one of: ${VALID_QUESTION_FORMATS.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate difficulty
 */
export function validateDifficulty(difficulty: string): {
    valid: boolean;
    error?: string;
} {
    if (!VALID_DIFFICULTIES.includes(difficulty as Difficulty)) {
        return {
            valid: false,
            error: `difficulty must be one of: ${VALID_DIFFICULTIES.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate time_limit_seconds
 */
export function validateTimeLimit(time_limit_seconds: number): {
    valid: boolean;
    error?: string;
} {
    if (!Number.isInteger(time_limit_seconds) || time_limit_seconds <= 0) {
        return {
            valid: false,
            error: "time_limit_seconds must be a positive integer",
        };
    }
    return { valid: true };
}

/**
 * Validate MCQ options structure
 */
export function validateMCQOptions(
    options: any,
    isTrueFalse: boolean = false
): { valid: boolean; error?: string } {
    if (!options || typeof options !== "object") {
        return { valid: false, error: "options must be an object" };
    }

    const mcqOptions = options as MCQOptions;
    if (!Array.isArray(mcqOptions.choices)) {
        return { valid: false, error: "options.choices must be an array" };
    }

    const minChoices = isTrueFalse ? 2 : 2;
    const maxChoices = isTrueFalse ? 2 : undefined;

    if (mcqOptions.choices.length < minChoices) {
        return {
            valid: false,
            error: `options.choices must have at least ${minChoices} items`,
        };
    }

    if (maxChoices && mcqOptions.choices.length !== maxChoices) {
        return {
            valid: false,
            error: `TRUE_FALSE must have exactly ${maxChoices} choices`,
        };
    }

    for (const choice of mcqOptions.choices) {
        if (!choice.id || !choice.text) {
            return {
                valid: false,
                error: "Each choice must have 'id' and 'text' fields",
            };
        }
    }

    return { valid: true };
}

/**
 * Validate Matching options structure
 */
export function validateMatchingOptions(options: any): {
    valid: boolean;
    error?: string;
} {
    if (!options || typeof options !== "object") {
        return { valid: false, error: "options must be an object" };
    }

    const matchingOptions = options as MatchingOptions;
    if (!Array.isArray(matchingOptions.left) || !Array.isArray(matchingOptions.right)) {
        return {
            valid: false,
            error: "options must have 'left' and 'right' arrays",
        };
    }

    if (matchingOptions.left.length === 0 || matchingOptions.right.length === 0) {
        return {
            valid: false,
            error: "left and right arrays must not be empty",
        };
    }

    for (const item of [...matchingOptions.left, ...matchingOptions.right]) {
        if (!item.id || !item.text) {
            return {
                valid: false,
                error: "Each item must have 'id' and 'text' fields",
            };
        }
    }

    return { valid: true };
}

/**
 * Validate Ordering options structure
 */
export function validateOrderingOptions(options: any): {
    valid: boolean;
    error?: string;
} {
    if (!options || typeof options !== "object") {
        return { valid: false, error: "options must be an object" };
    }

    const orderingOptions = options as OrderingOptions;
    if (!Array.isArray(orderingOptions.items)) {
        return { valid: false, error: "options.items must be an array" };
    }

    if (orderingOptions.items.length < 2) {
        return {
            valid: false,
            error: "options.items must have at least 2 items",
        };
    }

    for (const item of orderingOptions.items) {
        if (!item.id || !item.text) {
            return {
                valid: false,
                error: "Each item must have 'id' and 'text' fields",
            };
        }
    }

    return { valid: true };
}

/**
 * Validate Fill Blank options structure
 */
export function validateFillBlankOptions(options: any): {
    valid: boolean;
    error?: string;
} {
    if (!options || typeof options !== "object") {
        return { valid: false, error: "options must be an object" };
    }

    const fillBlankOptions = options as FillBlankOptions;
    if (!fillBlankOptions.text || typeof fillBlankOptions.text !== "string") {
        return { valid: false, error: "options.text must be a string" };
    }

    if (!Array.isArray(fillBlankOptions.blanks)) {
        return { valid: false, error: "options.blanks must be an array" };
    }

    for (const blank of fillBlankOptions.blanks) {
        if (!blank.id) {
            return {
                valid: false,
                error: "Each blank must have an 'id' field",
            };
        }
    }

    return { valid: true };
}

/**
 * Validate correct_answer based on question format
 */
export function validateCorrectAnswer(
    question_format: QuestionFormat,
    correct_answer: any,
    options?: any
): { valid: boolean; error?: string } {
    if (!correct_answer) {
        return { valid: false, error: "correct_answer is required" };
    }

    switch (question_format) {
        case "MCQ_SINGLE":
        case "TRUE_FALSE":
            if (!correct_answer.choiceId) {
                return {
                    valid: false,
                    error: "correct_answer.choiceId is required",
                };
            }
            break;

        case "MCQ_MULTI":
            if (!Array.isArray(correct_answer.choiceIds) || correct_answer.choiceIds.length === 0) {
                return {
                    valid: false,
                    error: "correct_answer.choiceIds must be a non-empty array",
                };
            }
            break;

        case "MATCHING":
            if (!Array.isArray(correct_answer.pairs)) {
                return {
                    valid: false,
                    error: "correct_answer.pairs must be an array",
                };
            }
            if (options && options.left && correct_answer.pairs.length !== options.left.length) {
                return {
                    valid: false,
                    error: "correct_answer.pairs size must match options.left size",
                };
            }
            for (const pair of correct_answer.pairs) {
                if (!pair.leftId || !pair.rightId) {
                    return {
                        valid: false,
                        error: "Each pair must have 'leftId' and 'rightId'",
                    };
                }
            }
            break;

        case "ORDERING":
            if (!Array.isArray(correct_answer.order)) {
                return {
                    valid: false,
                    error: "correct_answer.order must be an array",
                };
            }
            if (options && options.items) {
                const itemIds = new Set(options.items.map((item: any) => item.id));
                const orderIds = new Set(correct_answer.order);
                if (itemIds.size !== orderIds.size || ![...itemIds].every(id => orderIds.has(id))) {
                    return {
                        valid: false,
                        error: "correct_answer.order must contain same ids as options.items",
                    };
                }
            }
            break;

        case "FILL_BLANK":
            if (!correct_answer.blanks || typeof correct_answer.blanks !== "object") {
                return {
                    valid: false,
                    error: "correct_answer.blanks must be an object",
                };
            }
            if (options && options.blanks) {
                const blankIds = options.blanks.map((blank: any) => blank.id);
                for (const blankId of blankIds) {
                    if (!correct_answer.blanks[blankId]) {
                        return {
                            valid: false,
                            error: `correct_answer.blanks must have key '${blankId}'`,
                        };
                    }
                }
            }
            break;

        case "NUMERIC":
            const hasValueTolerance = correct_answer.value !== undefined;
            const hasMinMax = correct_answer.min !== undefined && correct_answer.max !== undefined;
            if (!hasValueTolerance && !hasMinMax) {
                return {
                    valid: false,
                    error: "correct_answer must have either {value, tolerance?} or {min, max}",
                };
            }
            break;
    }

    return { valid: true };
}

/**
 * Validate reward configuration fields
 */
export function validateRewardConfig(data: {
    base_xp?: number;
    min_xp?: number;
    xp_decay_per_wrong?: number;
    base_gold?: number;
    min_gold?: number;
    gold_decay_per_wrong?: number;
}): { valid: boolean; error?: string } {
    // Validate base_xp
    if (data.base_xp !== undefined) {
        if (typeof data.base_xp !== "number" || data.base_xp < 0) {
            return {
                valid: false,
                error: "base_xp must be a non-negative number",
            };
        }
    }

    // Validate min_xp
    if (data.min_xp !== undefined) {
        if (typeof data.min_xp !== "number" || data.min_xp < 0) {
            return {
                valid: false,
                error: "min_xp must be a non-negative number",
            };
        }
    }

    // Validate min_xp <= base_xp
    if (
        data.base_xp !== undefined &&
        data.min_xp !== undefined &&
        data.min_xp > data.base_xp
    ) {
        return {
            valid: false,
            error: "min_xp cannot be greater than base_xp",
        };
    }

    // Validate xp_decay_per_wrong
    if (data.xp_decay_per_wrong !== undefined) {
        if (typeof data.xp_decay_per_wrong !== "number" || data.xp_decay_per_wrong < 0) {
            return {
                valid: false,
                error: "xp_decay_per_wrong must be a non-negative number",
            };
        }
    }

    // Validate base_gold
    if (data.base_gold !== undefined) {
        if (typeof data.base_gold !== "number" || data.base_gold < 0) {
            return {
                valid: false,
                error: "base_gold must be a non-negative number",
            };
        }
    }

    // Validate min_gold
    if (data.min_gold !== undefined) {
        if (typeof data.min_gold !== "number" || data.min_gold < 0) {
            return {
                valid: false,
                error: "min_gold must be a non-negative number",
            };
        }
    }

    // Validate min_gold <= base_gold
    if (
        data.base_gold !== undefined &&
        data.min_gold !== undefined &&
        data.min_gold > data.base_gold
    ) {
        return {
            valid: false,
            error: "min_gold cannot be greater than base_gold",
        };
    }

    // Validate gold_decay_per_wrong
    if (data.gold_decay_per_wrong !== undefined) {
        if (typeof data.gold_decay_per_wrong !== "number" || data.gold_decay_per_wrong < 0) {
            return {
                valid: false,
                error: "gold_decay_per_wrong must be a non-negative number",
            };
        }
    }

    return { valid: true };
}

/**
 * Validate complete question data
 */
export function validateQuestion(data: {
    question_format: QuestionFormat;
    prompt?: string;
    options?: any;
    correct_answer?: any;
    max_points?: number;
    auto_gradable?: boolean;
    difficulty?: string;
    time_limit_seconds?: number;
    base_xp?: number;
    min_xp?: number;
    xp_decay_per_wrong?: number;
    base_gold?: number;
    min_gold?: number;
    gold_decay_per_wrong?: number;
}): { valid: boolean; error?: string } {
    // Validate prompt
    if (!data.prompt || typeof data.prompt !== "string" || data.prompt.trim() === "") {
        return { valid: false, error: "prompt is required and must be non-empty" };
    }

    // Validate max_points
    if (data.max_points === undefined || typeof data.max_points !== "number" || data.max_points < 0) {
        return {
            valid: false,
            error: "max_points is required and must be >= 0",
        };
    }

    // Validate difficulty if provided
    if (data.difficulty !== undefined) {
        const difficultyValidation = validateDifficulty(data.difficulty);
        if (!difficultyValidation.valid) {
            return difficultyValidation;
        }
    }

    // Validate time_limit_seconds if provided
    if (data.time_limit_seconds !== undefined) {
        const timeLimitValidation = validateTimeLimit(data.time_limit_seconds);
        if (!timeLimitValidation.valid) {
            return timeLimitValidation;
        }
    }

    // Validate reward configuration if provided
    const rewardValidation = validateRewardConfig(data);
    if (!rewardValidation.valid) {
        return rewardValidation;
    }

    // Format-specific validation
    switch (data.question_format) {
        case "MCQ_SINGLE":
        case "MCQ_MULTI":
            const mcqValidation = validateMCQOptions(data.options);
            if (!mcqValidation.valid) return mcqValidation;
            break;

        case "TRUE_FALSE":
            const tfValidation = validateMCQOptions(data.options, true);
            if (!tfValidation.valid) return tfValidation;
            break;

        case "MATCHING":
            const matchingValidation = validateMatchingOptions(data.options);
            if (!matchingValidation.valid) return matchingValidation;
            break;

        case "ORDERING":
            const orderingValidation = validateOrderingOptions(data.options);
            if (!orderingValidation.valid) return orderingValidation;
            break;

        case "FILL_BLANK":
            const fillBlankValidation = validateFillBlankOptions(data.options);
            if (!fillBlankValidation.valid) return fillBlankValidation;
            break;
    }

    // Validate correct_answer for auto-gradable questions
    if (
        data.auto_gradable === true &&
        AUTO_GRADABLE_FORMATS.includes(data.question_format)
    ) {
        const answerValidation = validateCorrectAnswer(
            data.question_format,
            data.correct_answer,
            data.options
        );
        if (!answerValidation.valid) return answerValidation;
    }

    return { valid: true };
}

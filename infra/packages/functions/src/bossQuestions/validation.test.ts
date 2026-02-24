/**
 * Validation tests for BossQuestions
 *
 * These tests demonstrate the validation behavior for time_limit_seconds.
 * Run with: node --loader tsx validation.test.ts (or via a test runner)
 */

import { validateQuestion, validateTimeLimit } from "./validation.js";

// Test helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== BossQuestions Validation Tests ===\n");

// Test 1: No time_limit_seconds → accepted
console.log("Test 1: No time_limit_seconds");
const test1 = validateQuestion({
    order_index: 0,
    question_text: "Test question",
    question_type: "MCQ_SINGLE",
    damage_to_boss_on_correct: 10,
    damage_to_guild_on_incorrect: 5,
    auto_gradable: true,
    correct_answer: { choiceId: "a" },
});
assert(test1.valid === true, "Should accept question without time_limit_seconds");

// Test 2: time_limit_seconds = 30 → accepted
console.log("\nTest 2: time_limit_seconds = 30");
const test2 = validateQuestion({
    order_index: 0,
    question_text: "Test question",
    question_type: "MCQ_SINGLE",
    damage_to_boss_on_correct: 10,
    damage_to_guild_on_incorrect: 5,
    auto_gradable: true,
    correct_answer: { choiceId: "a" },
    time_limit_seconds: 30,
});
assert(test2.valid === true, "Should accept time_limit_seconds = 30");

// Test 3: time_limit_seconds = 0 → rejected
console.log("\nTest 3: time_limit_seconds = 0");
const test3 = validateQuestion({
    order_index: 0,
    question_text: "Test question",
    question_type: "MCQ_SINGLE",
    damage_to_boss_on_correct: 10,
    damage_to_guild_on_incorrect: 5,
    auto_gradable: true,
    correct_answer: { choiceId: "a" },
    time_limit_seconds: 0,
});
assert(test3.valid === false, "Should reject time_limit_seconds = 0");
assert(
    test3.error === "time_limit_seconds must be a positive integer",
    "Should have correct error message for zero"
);

// Test 4: time_limit_seconds = -5 → rejected
console.log("\nTest 4: time_limit_seconds = -5");
const test4 = validateQuestion({
    order_index: 0,
    question_text: "Test question",
    question_type: "MCQ_SINGLE",
    damage_to_boss_on_correct: 10,
    damage_to_guild_on_incorrect: 5,
    auto_gradable: true,
    correct_answer: { choiceId: "a" },
    time_limit_seconds: -5,
});
assert(test4.valid === false, "Should reject negative time_limit_seconds");
assert(
    test4.error === "time_limit_seconds must be a positive integer",
    "Should have correct error message for negative"
);

// Test 5: time_limit_seconds = 2.5 → rejected
console.log("\nTest 5: time_limit_seconds = 2.5");
const test5 = validateQuestion({
    order_index: 0,
    question_text: "Test question",
    question_type: "MCQ_SINGLE",
    damage_to_boss_on_correct: 10,
    damage_to_guild_on_incorrect: 5,
    auto_gradable: true,
    correct_answer: { choiceId: "a" },
    time_limit_seconds: 2.5,
});
assert(test5.valid === false, "Should reject non-integer time_limit_seconds");
assert(
    test5.error === "time_limit_seconds must be a positive integer",
    "Should have correct error message for non-integer"
);

// Test 6: Direct validateTimeLimit function tests
console.log("\nTest 6: Direct validateTimeLimit function");
const directTest1 = validateTimeLimit(60);
assert(directTest1.valid === true, "validateTimeLimit should accept 60");

const directTest2 = validateTimeLimit(0);
assert(directTest2.valid === false, "validateTimeLimit should reject 0");

const directTest3 = validateTimeLimit(-10);
assert(directTest3.valid === false, "validateTimeLimit should reject negative");

const directTest4 = validateTimeLimit(3.14);
assert(directTest4.valid === false, "validateTimeLimit should reject decimal");

console.log("\n=== Tests Complete ===\n");

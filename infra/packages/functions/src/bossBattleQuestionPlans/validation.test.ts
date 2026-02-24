/**
 * Tests for BossBattleQuestionPlans validation functions
 *
 * Run with: node --loader tsx validation.test.ts
 */

import {
    validateModeType,
    validateQuestionSelectionMode,
    validateQuestionIds,
    validateQuestionCount,
    validateGuildQuestionIds,
    validateGuildQuestionCount,
} from "./validation.js";

// Test helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== BossBattleQuestionPlans Validation Tests ===\n");

// Test 1: validateModeType
console.log("Test 1: validateModeType");
assert(
    validateModeType("SIMULTANEOUS_ALL").valid === true,
    "SIMULTANEOUS_ALL should be valid"
);
assert(
    validateModeType("TURN_BASED_GUILD").valid === true,
    "TURN_BASED_GUILD should be valid"
);
assert(
    validateModeType("RANDOMIZED_PER_GUILD").valid === true,
    "RANDOMIZED_PER_GUILD should be valid"
);
assert(
    validateModeType("INVALID_MODE").valid === false,
    "INVALID_MODE should be invalid"
);
assert(
    validateModeType(null).valid === false,
    "null should be invalid"
);
assert(
    validateModeType(undefined).valid === false,
    "undefined should be invalid"
);

// Test 2: validateQuestionSelectionMode
console.log("\nTest 2: validateQuestionSelectionMode");
assert(
    validateQuestionSelectionMode("ORDERED").valid === true,
    "ORDERED should be valid"
);
assert(
    validateQuestionSelectionMode("RANDOM_NO_REPEAT").valid === true,
    "RANDOM_NO_REPEAT should be valid"
);
assert(
    validateQuestionSelectionMode("INVALID").valid === false,
    "INVALID should be invalid"
);
assert(
    validateQuestionSelectionMode("").valid === false,
    "Empty string should be invalid"
);

// Test 3: validateQuestionIds - valid cases
console.log("\nTest 3: validateQuestionIds - valid cases");
assert(
    validateQuestionIds(["q1", "q2", "q3"]).valid === true,
    "Array of strings should be valid"
);
assert(
    validateQuestionIds(["single"]).valid === true,
    "Single element array should be valid"
);

// Test 4: validateQuestionIds - invalid cases
console.log("\nTest 4: validateQuestionIds - invalid cases");
assert(
    validateQuestionIds([]).valid === false,
    "Empty array should be invalid"
);
assert(
    validateQuestionIds("not-an-array").valid === false,
    "String should be invalid"
);
assert(
    validateQuestionIds(null).valid === false,
    "null should be invalid"
);
assert(
    validateQuestionIds(["q1", "", "q3"]).valid === false,
    "Array with empty string should be invalid"
);
assert(
    validateQuestionIds(["q1", null, "q3"]).valid === false,
    "Array with null should be invalid"
);
assert(
    validateQuestionIds(["q1", 123, "q3"]).valid === false,
    "Array with non-string should be invalid"
);

// Test 5: validateQuestionCount - valid cases
console.log("\nTest 5: validateQuestionCount - valid cases");
assert(
    validateQuestionCount(3, ["q1", "q2", "q3"]).valid === true,
    "Matching count should be valid"
);
assert(
    validateQuestionCount(0, []).valid === true,
    "Zero count with empty array should be valid"
);

// Test 6: validateQuestionCount - invalid cases
console.log("\nTest 6: validateQuestionCount - invalid cases");
assert(
    validateQuestionCount(5, ["q1", "q2", "q3"]).valid === false,
    "Mismatched count should be invalid"
);
assert(
    validateQuestionCount(-1, ["q1"]).valid === false,
    "Negative count should be invalid"
);
assert(
    validateQuestionCount("3", ["q1", "q2", "q3"]).valid === false,
    "String count should be invalid"
);
assert(
    validateQuestionCount(null, ["q1"]).valid === false,
    "null count should be invalid"
);

// Test 7: validateGuildQuestionIds - valid cases
console.log("\nTest 7: validateGuildQuestionIds - valid cases");
const validGuildMap = {
    "guild1": ["q1", "q2", "q3"],
    "guild2": ["q3", "q1", "q2"],
};
assert(
    validateGuildQuestionIds(validGuildMap).valid === true,
    "Valid guild map should be valid"
);

const singleGuildMap = {
    "guild1": ["q1"],
};
assert(
    validateGuildQuestionIds(singleGuildMap).valid === true,
    "Single guild with single question should be valid"
);

// Test 8: validateGuildQuestionIds - invalid cases
console.log("\nTest 8: validateGuildQuestionIds - invalid cases");
assert(
    validateGuildQuestionIds({}).valid === false,
    "Empty object should be invalid"
);
assert(
    validateGuildQuestionIds([]).valid === false,
    "Array should be invalid"
);
assert(
    validateGuildQuestionIds(null).valid === false,
    "null should be invalid"
);
assert(
    validateGuildQuestionIds("not-object").valid === false,
    "String should be invalid"
);

const emptyArrayGuild = { "guild1": [] };
assert(
    validateGuildQuestionIds(emptyArrayGuild).valid === false,
    "Guild with empty array should be invalid"
);

const nonArrayGuild = { "guild1": "q1,q2" };
assert(
    validateGuildQuestionIds(nonArrayGuild).valid === false,
    "Guild with non-array should be invalid"
);

const invalidQuestionId = { "guild1": ["q1", "", "q3"] };
assert(
    validateGuildQuestionIds(invalidQuestionId).valid === false,
    "Guild with empty string question should be invalid"
);

// Test 9: validateGuildQuestionCount - valid cases
console.log("\nTest 9: validateGuildQuestionCount - valid cases");
const guildIds = {
    "guild1": ["q1", "q2", "q3"],
    "guild2": ["q1", "q2"],
};
const guildCounts = {
    "guild1": 3,
    "guild2": 2,
};
assert(
    validateGuildQuestionCount(guildCounts, guildIds).valid === true,
    "Matching counts should be valid"
);

// Test 10: validateGuildQuestionCount - invalid cases
console.log("\nTest 10: validateGuildQuestionCount - invalid cases");
const mismatchedCount = {
    "guild1": 5,
    "guild2": 2,
};
assert(
    validateGuildQuestionCount(mismatchedCount, guildIds).valid === false,
    "Mismatched count should be invalid"
);

const missingGuild = {
    "guild1": 3,
};
assert(
    validateGuildQuestionCount(missingGuild, guildIds).valid === false,
    "Missing guild should be invalid"
);

const extraGuild = {
    "guild1": 3,
    "guild2": 2,
    "guild3": 1,
};
assert(
    validateGuildQuestionCount(extraGuild, guildIds).valid === false,
    "Extra guild should be invalid"
);

const negativeCount = {
    "guild1": -1,
    "guild2": 2,
};
assert(
    validateGuildQuestionCount(negativeCount, guildIds).valid === false,
    "Negative count should be invalid"
);

const stringCount = {
    "guild1": "3",
    "guild2": 2,
};
assert(
    validateGuildQuestionCount(stringCount, guildIds).valid === false,
    "String count should be invalid"
);

assert(
    validateGuildQuestionCount(null, guildIds).valid === false,
    "null count object should be invalid"
);

assert(
    validateGuildQuestionCount([], guildIds).valid === false,
    "Array should be invalid"
);

console.log("\n=== Validation Tests Complete ===\n");

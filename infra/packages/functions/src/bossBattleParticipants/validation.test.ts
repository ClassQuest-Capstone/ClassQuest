/**
 * Validation tests for BossBattleParticipants
 *
 * Run with: node --loader tsx validation.test.ts
 */

import {
    validateState,
    validateRequiredString,
    validateISOTimestamp,
    validateJoinInput,
    validateAntiSpamFieldsInput,
} from "./validation.js";
import { ParticipantState } from "./types.js";

// Test helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== BossBattleParticipants Validation Tests ===\n");

// Test 1: Valid state values
console.log("Test 1: Valid state values");
const state1 = validateState(ParticipantState.JOINED);
assert(state1.valid === true, "Should accept JOINED");

const state2 = validateState(ParticipantState.SPECTATE);
assert(state2.valid === true, "Should accept SPECTATE");

const state3 = validateState(ParticipantState.KICKED);
assert(state3.valid === true, "Should accept KICKED");

const state4 = validateState(ParticipantState.LEFT);
assert(state4.valid === true, "Should accept LEFT");

// Test 2: Invalid state value
console.log("\nTest 2: Invalid state value");
const state5 = validateState("INVALID_STATE");
assert(state5.valid === false, "Should reject invalid state");
assert(
    state5.valid === false && state5.error.includes("must be one of"),
    "Should have correct error message"
);

// Test 3: Required string validation
console.log("\nTest 3: Required string validation");
const str1 = validateRequiredString("valid-id", "field_name");
assert(str1.valid === true, "Should accept valid string");

const str2 = validateRequiredString("", "field_name");
assert(str2.valid === false, "Should reject empty string");

const str3 = validateRequiredString(null, "field_name");
assert(str3.valid === false, "Should reject null");

const str4 = validateRequiredString(undefined, "field_name");
assert(str4.valid === false, "Should reject undefined");

// Test 4: ISO timestamp validation
console.log("\nTest 4: ISO timestamp validation");
const ts1 = validateISOTimestamp("2026-02-24T12:00:00.000Z", "timestamp");
assert(ts1.valid === true, "Should accept valid ISO timestamp with milliseconds");

const ts2 = validateISOTimestamp("2026-02-24T12:00:00Z", "timestamp");
assert(ts2.valid === true, "Should accept valid ISO timestamp without milliseconds");

const ts3 = validateISOTimestamp("2026-02-24 12:00:00", "timestamp");
assert(ts3.valid === false, "Should reject non-ISO format");

const ts4 = validateISOTimestamp("invalid", "timestamp");
assert(ts4.valid === false, "Should reject invalid timestamp");

// Test 5: Valid join input
console.log("\nTest 5: Valid join input");
const join1 = validateJoinInput({
    boss_instance_id: "battle-123",
    student_id: "student-456",
    class_id: "class-789",
    guild_id: "guild-101",
});
assert(join1.valid === true, "Should accept valid join input");

// Test 6: Missing boss_instance_id
console.log("\nTest 6: Missing boss_instance_id");
const join2 = validateJoinInput({
    student_id: "student-456",
    class_id: "class-789",
    guild_id: "guild-101",
});
assert(join2.valid === false, "Should reject missing boss_instance_id");

// Test 7: Missing student_id
console.log("\nTest 7: Missing student_id");
const join3 = validateJoinInput({
    boss_instance_id: "battle-123",
    class_id: "class-789",
    guild_id: "guild-101",
});
assert(join3.valid === false, "Should reject missing student_id");

// Test 8: Missing guild_id
console.log("\nTest 8: Missing guild_id");
const join4 = validateJoinInput({
    boss_instance_id: "battle-123",
    student_id: "student-456",
    class_id: "class-789",
});
assert(join4.valid === false, "Should reject missing guild_id");

// Test 9: Valid anti-spam fields input (empty)
console.log("\nTest 9: Valid anti-spam fields input (empty)");
const spam1 = validateAntiSpamFieldsInput({});
assert(spam1.valid === true, "Should accept empty anti-spam input");

// Test 10: Valid anti-spam fields with last_submit_at
console.log("\nTest 10: Valid anti-spam fields with last_submit_at");
const spam2 = validateAntiSpamFieldsInput({
    last_submit_at: "2026-02-24T12:00:00.000Z",
});
assert(spam2.valid === true, "Should accept valid last_submit_at");

// Test 11: Valid anti-spam fields with frozen_until
console.log("\nTest 11: Valid anti-spam fields with frozen_until");
const spam3 = validateAntiSpamFieldsInput({
    frozen_until: "2026-02-24T12:05:00.000Z",
});
assert(spam3.valid === true, "Should accept valid frozen_until");

// Test 12: Invalid anti-spam timestamp format
console.log("\nTest 12: Invalid anti-spam timestamp format");
const spam4 = validateAntiSpamFieldsInput({
    last_submit_at: "invalid-timestamp",
});
assert(spam4.valid === false, "Should reject invalid timestamp format");

console.log("\n=== Tests Complete ===\n");

/**
 * Validation tests for BossResults
 *
 * Run with: node --loader tsx validation.test.ts
 */

import {
    validateNonNegative,
    validateOutcome,
    validateFailReason,
    validateParticipationState,
    validateISOTimestamp,
} from "./validation.js";

// Test helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== BossResults Validation Tests ===\n");

// Test 1: Validate non-negative numbers
console.log("Test 1: Validate non-negative numbers");
const num1 = validateNonNegative(10, "test_field");
assert(num1.valid === true, "Should accept positive number");

const num2 = validateNonNegative(0, "test_field");
assert(num2.valid === true, "Should accept 0");

const num3 = validateNonNegative(-5, "test_field");
assert(num3.valid === false, "Should reject negative number");

// Test 2: Validate battle outcome
console.log("\nTest 2: Validate battle outcome");
const outcome1 = validateOutcome("WIN");
assert(outcome1.valid === true, "Should accept WIN");

const outcome2 = validateOutcome("FAIL");
assert(outcome2.valid === true, "Should accept FAIL");

const outcome3 = validateOutcome("ABORTED");
assert(outcome3.valid === true, "Should accept ABORTED");

const outcome4 = validateOutcome("INVALID");
assert(outcome4.valid === false, "Should reject invalid outcome");

// Test 3: Validate fail reason
console.log("\nTest 3: Validate fail reason");
const reason1 = validateFailReason("TIMEOUT");
assert(reason1.valid === true, "Should accept TIMEOUT");

const reason2 = validateFailReason("ALL_GUILDS_DOWN");
assert(reason2.valid === true, "Should accept ALL_GUILDS_DOWN");

const reason3 = validateFailReason("OUT_OF_QUESTIONS");
assert(reason3.valid === true, "Should accept OUT_OF_QUESTIONS");

const reason4 = validateFailReason("ABORTED_BY_TEACHER");
assert(reason4.valid === true, "Should accept ABORTED_BY_TEACHER");

const reason5 = validateFailReason("INVALID");
assert(reason5.valid === false, "Should reject invalid fail reason");

// Test 4: Validate participation state
console.log("\nTest 4: Validate participation state");
const state1 = validateParticipationState("JOINED");
assert(state1.valid === true, "Should accept JOINED");

const state2 = validateParticipationState("SPECTATE");
assert(state2.valid === true, "Should accept SPECTATE");

const state3 = validateParticipationState("KICKED");
assert(state3.valid === true, "Should accept KICKED");

const state4 = validateParticipationState("LEFT");
assert(state4.valid === true, "Should accept LEFT");

const state5 = validateParticipationState("DOWNED");
assert(state5.valid === true, "Should accept DOWNED");

const state6 = validateParticipationState("INVALID");
assert(state6.valid === false, "Should reject invalid state");

// Test 5: Validate ISO timestamp
console.log("\nTest 5: Validate ISO timestamp");
const ts1 = validateISOTimestamp("2026-02-24T12:00:00.000Z", "timestamp");
assert(ts1.valid === true, "Should accept valid ISO timestamp");

const ts2 = validateISOTimestamp("2026-02-24T12:00:00Z", "timestamp");
assert(ts2.valid === true, "Should accept valid ISO timestamp without ms");

const ts3 = validateISOTimestamp("2026-02-24 12:00:00", "timestamp");
assert(ts3.valid === false, "Should reject non-ISO format");

const ts4 = validateISOTimestamp(123456, "timestamp");
assert(ts4.valid === false, "Should reject non-string");

console.log("\n=== Tests Complete ===\n");

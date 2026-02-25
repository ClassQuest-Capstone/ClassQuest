/**
 * Validation tests for BossAnswerAttempts
 *
 * Run with: node --loader tsx validation.test.ts
 */

import {
    validateElapsedSeconds,
    validateEffectiveTimeLimit,
    validateSpeedMultiplier,
    validateDamageToBoss,
    validateHeartsDelta,
    validateModeType,
    validateStatusAtSubmit,
    validateAnswerRaw,
    validateCreateAttemptInput,
} from "./validation.js";
import { CreateBossAnswerAttemptInput } from "./types.js";

// Test helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== BossAnswerAttempts Validation Tests ===\n");

// Test 1: Valid elapsed_seconds
console.log("Test 1: Valid elapsed_seconds");
const elapsed1 = validateElapsedSeconds(10.5);
assert(elapsed1.valid === true, "Should accept valid elapsed_seconds");

const elapsed2 = validateElapsedSeconds(0);
assert(elapsed2.valid === true, "Should accept 0 elapsed_seconds");

// Test 2: Invalid elapsed_seconds (negative)
console.log("\nTest 2: Invalid elapsed_seconds (negative)");
const elapsed3 = validateElapsedSeconds(-5);
assert(elapsed3.valid === false, "Should reject negative elapsed_seconds");

// Test 3: Valid effective_time_limit_seconds
console.log("\nTest 3: Valid effective_time_limit_seconds");
const timeLimit1 = validateEffectiveTimeLimit(60);
assert(timeLimit1.valid === true, "Should accept valid time limit");

const timeLimit2 = validateEffectiveTimeLimit(undefined);
assert(timeLimit2.valid === true, "Should accept undefined (optional)");

const timeLimit3 = validateEffectiveTimeLimit(1);
assert(timeLimit3.valid === true, "Should accept 1");

// Test 4: Invalid effective_time_limit_seconds (0 or negative)
console.log("\nTest 4: Invalid effective_time_limit_seconds");
const timeLimit4 = validateEffectiveTimeLimit(0);
assert(timeLimit4.valid === false, "Should reject 0");

const timeLimit5 = validateEffectiveTimeLimit(-10);
assert(timeLimit5.valid === false, "Should reject negative");

const timeLimit6 = validateEffectiveTimeLimit(5.5);
assert(timeLimit6.valid === false, "Should reject non-integer");

// Test 5: Valid speed_multiplier
console.log("\nTest 5: Valid speed_multiplier");
const speed1 = validateSpeedMultiplier(0.5);
assert(speed1.valid === true, "Should accept 0.5");

const speed2 = validateSpeedMultiplier(0);
assert(speed2.valid === true, "Should accept 0");

const speed3 = validateSpeedMultiplier(1);
assert(speed3.valid === true, "Should accept 1");

const speed4 = validateSpeedMultiplier(undefined);
assert(speed4.valid === true, "Should accept undefined (optional)");

// Test 6: Invalid speed_multiplier (out of range)
console.log("\nTest 6: Invalid speed_multiplier");
const speed5 = validateSpeedMultiplier(-0.1);
assert(speed5.valid === false, "Should reject negative");

const speed6 = validateSpeedMultiplier(1.5);
assert(speed6.valid === false, "Should reject > 1");

// Test 7: Valid damage_to_boss
console.log("\nTest 7: Valid damage_to_boss");
const damage1 = validateDamageToBoss(100);
assert(damage1.valid === true, "Should accept positive damage");

const damage2 = validateDamageToBoss(0);
assert(damage2.valid === true, "Should accept 0 damage");

// Test 8: Invalid damage_to_boss (negative)
console.log("\nTest 8: Invalid damage_to_boss");
const damage3 = validateDamageToBoss(-10);
assert(damage3.valid === false, "Should reject negative damage");

// Test 9: Valid hearts delta (0 or negative)
console.log("\nTest 9: Valid hearts delta");
const hearts1 = validateHeartsDelta(0, "hearts_delta_student");
assert(hearts1.valid === true, "Should accept 0");

const hearts2 = validateHeartsDelta(-5, "hearts_delta_student");
assert(hearts2.valid === true, "Should accept negative");

// Test 10: Invalid hearts delta (positive)
console.log("\nTest 10: Invalid hearts delta");
const hearts3 = validateHeartsDelta(5, "hearts_delta_student");
assert(hearts3.valid === false, "Should reject positive hearts delta");

// Test 11: Valid mode_type
console.log("\nTest 11: Valid mode_type");
const mode1 = validateModeType("SIMULTANEOUS_ALL");
assert(mode1.valid === true, "Should accept SIMULTANEOUS_ALL");

const mode2 = validateModeType("TURN_BASED_GUILD");
assert(mode2.valid === true, "Should accept TURN_BASED_GUILD");

// Test 12: Invalid mode_type
console.log("\nTest 12: Invalid mode_type");
const mode3 = validateModeType("INVALID_MODE");
assert(mode3.valid === false, "Should reject invalid mode_type");

// Test 13: Valid status_at_submit
console.log("\nTest 13: Valid status_at_submit");
const status1 = validateStatusAtSubmit("QUESTION_ACTIVE");
assert(status1.valid === true, "Should accept QUESTION_ACTIVE");

const status2 = validateStatusAtSubmit("LOBBY");
assert(status2.valid === true, "Should accept LOBBY");

// Test 14: Invalid status_at_submit
console.log("\nTest 14: Invalid status_at_submit");
const status3 = validateStatusAtSubmit("INVALID_STATUS");
assert(status3.valid === false, "Should reject invalid status");

// Test 15: Valid answer_raw
console.log("\nTest 15: Valid answer_raw");
const answer1 = validateAnswerRaw({ selected_option: "A" });
assert(answer1.valid === true, "Should accept valid object");

// Test 16: Invalid answer_raw (array)
console.log("\nTest 16: Invalid answer_raw");
const answer2 = validateAnswerRaw(["A", "B"]);
assert(answer2.valid === false, "Should reject array");

const answer3 = validateAnswerRaw(null);
assert(answer3.valid === false, "Should reject null");

// Test 17: Valid full create input
console.log("\nTest 17: Valid full create input");
const input1: CreateBossAnswerAttemptInput = {
    boss_instance_id: "battle-123",
    class_id: "class-456",
    question_id: "question-789",
    student_id: "student-101",
    guild_id: "guild-202",
    answer_raw: { selected_option: "A" },
    is_correct: true,
    elapsed_seconds: 15.5,
    effective_time_limit_seconds: 60,
    speed_multiplier: 0.75,
    damage_to_boss: 100,
    hearts_delta_student: -1,
    hearts_delta_guild_total: -3,
    mode_type: "SIMULTANEOUS_ALL",
    status_at_submit: "QUESTION_ACTIVE",
};
const fullInput1 = validateCreateAttemptInput(input1);
assert(fullInput1.valid === true, "Should accept valid full input");

// Test 18: Missing required field
console.log("\nTest 18: Missing required field");
const input2 = {
    class_id: "class-456",
    question_id: "question-789",
    student_id: "student-101",
    guild_id: "guild-202",
    answer_raw: { selected_option: "A" },
    is_correct: true,
    elapsed_seconds: 15.5,
    damage_to_boss: 100,
    hearts_delta_student: 0,
    hearts_delta_guild_total: 0,
    mode_type: "SIMULTANEOUS_ALL",
    status_at_submit: "QUESTION_ACTIVE",
} as any;
const fullInput2 = validateCreateAttemptInput(input2);
assert(fullInput2.valid === false, "Should reject missing boss_instance_id");

console.log("\n=== Tests Complete ===\n");

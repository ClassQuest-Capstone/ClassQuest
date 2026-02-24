/**
 * Validation tests for BossBattleInstances
 *
 * Run with: node --loader tsx validation.test.ts
 */

import {
    validateCreateBattleInput,
    validateUpdateBattleInput,
    validateFloorMultiplier,
    validateHP,
    validateStatus,
    validateModeType,
} from "./validation.js";

// Test helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== BossBattleInstances Validation Tests ===\n");

// Test 1: Valid create input with defaults
console.log("Test 1: Valid create input with required fields only");
const test1 = validateCreateBattleInput({
    class_id: "class-123",
    boss_template_id: "template-456",
    created_by_teacher_id: "teacher-789",
    initial_boss_hp: 1000,
});
assert(test1.valid === true, "Should accept valid create input with required fields");

// Test 2: Valid create input with all optional fields
console.log("\nTest 2: Valid create input with all optional fields");
const test2 = validateCreateBattleInput({
    class_id: "class-123",
    boss_template_id: "template-456",
    created_by_teacher_id: "teacher-789",
    initial_boss_hp: 1000,
    mode_type: "SIMULTANEOUS_ALL",
    question_selection_mode: "ORDERED",
    speed_bonus_floor_multiplier: 0.5,
    speed_window_seconds: 60,
    anti_spam_min_submit_interval_ms: 2000,
    freeze_on_wrong_seconds: 5,
    late_join_policy: "ALLOW_SPECTATE",
    turn_policy: "ROUND_ROBIN",
});
assert(test2.valid === true, "Should accept valid create input with all fields");

// Test 3: Missing required field
console.log("\nTest 3: Missing required field (class_id)");
const test3 = validateCreateBattleInput({
    boss_template_id: "template-456",
    created_by_teacher_id: "teacher-789",
    initial_boss_hp: 1000,
});
assert(test3.valid === false, "Should reject missing class_id");
assert(test3.error === "class_id is required", "Should have correct error message");

// Test 4: Invalid initial_boss_hp (0)
console.log("\nTest 4: Invalid initial_boss_hp = 0");
const test4 = validateCreateBattleInput({
    class_id: "class-123",
    boss_template_id: "template-456",
    created_by_teacher_id: "teacher-789",
    initial_boss_hp: 0,
});
assert(test4.valid === false, "Should reject HP = 0");
assert(
    test4.error === "initial_boss_hp must be a positive integer >= 1",
    "Should have correct error message"
);

// Test 5: Invalid initial_boss_hp (negative)
console.log("\nTest 5: Invalid initial_boss_hp = -10");
const test5 = validateCreateBattleInput({
    class_id: "class-123",
    boss_template_id: "template-456",
    created_by_teacher_id: "teacher-789",
    initial_boss_hp: -10,
});
assert(test5.valid === false, "Should reject negative HP");

// Test 6: Invalid enum value
console.log("\nTest 6: Invalid mode_type");
const test6 = validateCreateBattleInput({
    class_id: "class-123",
    boss_template_id: "template-456",
    created_by_teacher_id: "teacher-789",
    initial_boss_hp: 1000,
    mode_type: "INVALID_MODE",
});
assert(test6.valid === false, "Should reject invalid mode_type");

// Test 7: Floor multiplier validation
console.log("\nTest 7: Floor multiplier validation");
const fm1 = validateFloorMultiplier(0.2);
assert(fm1.valid === true, "Should accept 0.2");

const fm2 = validateFloorMultiplier(0);
assert(fm2.valid === true, "Should accept 0");

const fm3 = validateFloorMultiplier(1);
assert(fm3.valid === true, "Should accept 1");

const fm4 = validateFloorMultiplier(-0.1);
assert(fm4.valid === false, "Should reject -0.1");

const fm5 = validateFloorMultiplier(1.5);
assert(fm5.valid === false, "Should reject 1.5");

// Test 8: Update validation
console.log("\nTest 8: Valid update input");
const test8 = validateUpdateBattleInput({
    status: "LOBBY",
    current_boss_hp: 950,
    current_question_index: 1,
    lobby_opened_at: "2026-02-24T12:00:00.000Z",
});
assert(test8.valid === true, "Should accept valid update input");

// Test 9: Invalid update status
console.log("\nTest 9: Invalid update status");
const test9 = validateUpdateBattleInput({
    status: "INVALID_STATUS",
});
assert(test9.valid === false, "Should reject invalid status");

// Test 10: Invalid timestamp format
console.log("\nTest 10: Invalid timestamp format");
const test10 = validateUpdateBattleInput({
    lobby_opened_at: "2026-02-24 12:00:00",
});
assert(test10.valid === false, "Should reject non-ISO timestamp");

// Test 11: Direct enum validation
console.log("\nTest 11: Direct enum validation");
const status1 = validateStatus("DRAFT");
assert(status1.valid === true, "Should accept DRAFT status");

const status2 = validateStatus("INVALID");
assert(status2.valid === false, "Should reject invalid status");

const mode1 = validateModeType("SIMULTANEOUS_ALL");
assert(mode1.valid === true, "Should accept valid mode type");

// Test 12: HP validation
console.log("\nTest 12: HP validation");
const hp1 = validateHP(1000, "initial_boss_hp");
assert(hp1.valid === true, "Should accept HP = 1000");

const hp2 = validateHP(1, "initial_boss_hp");
assert(hp2.valid === true, "Should accept HP = 1");

const hp3 = validateHP(0, "initial_boss_hp");
assert(hp3.valid === false, "Should reject HP = 0");

console.log("\n=== Tests Complete ===\n");

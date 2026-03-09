/**
 * Validation tests for StudentRewardClaims
 *
 * Run with: node --import tsx validation.test.ts
 */

import { validateCreateInput } from "./validation.ts";

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== StudentRewardClaims Validation Tests ===\n");

const validBase = {
    student_id:         "student_123",
    class_id:           "class_123",
    reward_id:          "reward_helmet_lvl5",
    status:             "AVAILABLE",
    unlocked_at_level:  5,
    reward_target_type: "ITEM",
    reward_target_id:   "item_rare_helmet_01",
};

// Test 1: Valid input passes
console.log("Test 1: Valid input passes");
const test1 = validateCreateInput(validBase);
assert(test1.length === 0, "Valid input has no errors");

// Test 2: CLAIMED status is also valid
console.log("\nTest 2: CLAIMED status is valid");
const test2 = validateCreateInput({ ...validBase, status: "CLAIMED" });
assert(test2.length === 0, "CLAIMED status is accepted");

// Test 3: Missing student_id
console.log("\nTest 3: Missing student_id");
const test3 = validateCreateInput({ ...validBase, student_id: "" });
assert(
    test3.some(e => e.field === "student_id" && e.message === "required"),
    "Empty student_id is rejected"
);

// Test 4: Missing class_id
console.log("\nTest 4: Missing class_id (undefined)");
const test4 = validateCreateInput({ ...validBase, class_id: undefined });
assert(
    test4.some(e => e.field === "class_id" && e.message === "required"),
    "Undefined class_id is rejected"
);

// Test 5: Missing reward_id
console.log("\nTest 5: Missing reward_id");
const test5 = validateCreateInput({ ...validBase, reward_id: null });
assert(
    test5.some(e => e.field === "reward_id" && e.message === "required"),
    "Null reward_id is rejected"
);

// Test 6: Invalid status
console.log("\nTest 6: Invalid status");
const test6 = validateCreateInput({ ...validBase, status: "PENDING" });
assert(
    test6.some(e => e.field === "status"),
    "Invalid status PENDING is rejected"
);

// Test 7: unlocked_at_level = 0 (below minimum)
console.log("\nTest 7: unlocked_at_level = 0");
const test7 = validateCreateInput({ ...validBase, unlocked_at_level: 0 });
assert(
    test7.some(e => e.field === "unlocked_at_level"),
    "unlocked_at_level = 0 is rejected"
);

// Test 8: unlocked_at_level = -1 (negative)
console.log("\nTest 8: unlocked_at_level = -1");
const test8 = validateCreateInput({ ...validBase, unlocked_at_level: -1 });
assert(
    test8.some(e => e.field === "unlocked_at_level"),
    "Negative unlocked_at_level is rejected"
);

// Test 9: unlocked_at_level = 2.5 (non-integer)
console.log("\nTest 9: unlocked_at_level = 2.5");
const test9 = validateCreateInput({ ...validBase, unlocked_at_level: 2.5 });
assert(
    test9.some(e => e.field === "unlocked_at_level"),
    "Non-integer unlocked_at_level is rejected"
);

// Test 10: Invalid reward_target_type
console.log("\nTest 10: Invalid reward_target_type");
const test10 = validateCreateInput({ ...validBase, reward_target_type: "SWORD" });
assert(
    test10.some(e => e.field === "reward_target_type"),
    "Invalid reward_target_type SWORD is rejected"
);

// Test 11: Missing reward_target_id
console.log("\nTest 11: Missing reward_target_id");
const test11 = validateCreateInput({ ...validBase, reward_target_id: "" });
assert(
    test11.some(e => e.field === "reward_target_id" && e.message === "required"),
    "Empty reward_target_id is rejected"
);

// Test 12: Multiple missing fields produce multiple errors
console.log("\nTest 12: Multiple missing fields");
const test12 = validateCreateInput({
    status: "AVAILABLE",
    unlocked_at_level: 5,
    reward_target_type: "ITEM",
    reward_target_id: "some_id",
});
assert(
    test12.some(e => e.field === "student_id") &&
    test12.some(e => e.field === "class_id") &&
    test12.some(e => e.field === "reward_id"),
    "Multiple missing required fields all produce errors"
);

// Test 13: All valid reward_target_type values accepted
console.log("\nTest 13: All valid reward_target_type values");
const validTargetTypes = ["ITEM", "AVATAR_TIER", "BACKGROUND", "PET", "BADGE", "CUSTOM"];
for (const t of validTargetTypes) {
    const r = validateCreateInput({ ...validBase, reward_target_type: t });
    assert(
        !r.some(e => e.field === "reward_target_type"),
        `reward_target_type "${t}" is accepted`
    );
}

console.log("\n=== Tests Complete ===\n");

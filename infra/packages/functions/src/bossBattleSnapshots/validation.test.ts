/**
 * Validation tests for BossBattleSnapshots
 *
 * Run with: node --loader tsx validation.test.ts
 */

import {
    validateParticipant,
    validateJoinedStudents,
    validateJoinedCount,
    validateGuildCounts,
} from "./validation.js";
import { SnapshotParticipant } from "./types.js";

// Test helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== BossBattleSnapshots Validation Tests ===\n");

// Test 1: Valid participant
console.log("Test 1: Valid participant");
const p1 = validateParticipant({
    student_id: "student-123",
    guild_id: "guild-456",
});
assert(p1.valid === true, "Should accept valid participant");

// Test 2: Missing student_id
console.log("\nTest 2: Missing student_id");
const p2 = validateParticipant({
    guild_id: "guild-456",
});
assert(p2.valid === false, "Should reject missing student_id");

// Test 3: Missing guild_id
console.log("\nTest 3: Missing guild_id");
const p3 = validateParticipant({
    student_id: "student-123",
});
assert(p3.valid === false, "Should reject missing guild_id");

// Test 4: Valid joined_students (empty)
console.log("\nTest 4: Valid joined_students (empty)");
const js1 = validateJoinedStudents([]);
assert(js1.valid === true, "Should accept empty array");

// Test 5: Valid joined_students (non-empty)
console.log("\nTest 5: Valid joined_students (non-empty)");
const js2 = validateJoinedStudents([
    { student_id: "student-1", guild_id: "guild-A" },
    { student_id: "student-2", guild_id: "guild-A" },
    { student_id: "student-3", guild_id: "guild-B" },
]);
assert(js2.valid === true, "Should accept valid array");

// Test 6: Invalid joined_students (not array)
console.log("\nTest 6: Invalid joined_students (not array)");
const js3 = validateJoinedStudents({ student_id: "student-1" });
assert(js3.valid === false, "Should reject non-array");

// Test 7: Invalid joined_students (invalid participant)
console.log("\nTest 7: Invalid joined_students (invalid participant)");
const js4 = validateJoinedStudents([
    { student_id: "student-1", guild_id: "guild-A" },
    { student_id: "student-2" }, // Missing guild_id
]);
assert(js4.valid === false, "Should reject invalid participant");

// Test 8: Valid joined_count
console.log("\nTest 8: Valid joined_count");
const students: SnapshotParticipant[] = [
    { student_id: "student-1", guild_id: "guild-A" },
    { student_id: "student-2", guild_id: "guild-A" },
    { student_id: "student-3", guild_id: "guild-B" },
];
const jc1 = validateJoinedCount(3, students);
assert(jc1.valid === true, "Should accept matching count");

// Test 9: Invalid joined_count (mismatch)
console.log("\nTest 9: Invalid joined_count (mismatch)");
const jc2 = validateJoinedCount(5, students);
assert(jc2.valid === false, "Should reject mismatched count");

// Test 10: Invalid joined_count (negative)
console.log("\nTest 10: Invalid joined_count (negative)");
const jc3 = validateJoinedCount(-1, students);
assert(jc3.valid === false, "Should reject negative count");

// Test 11: Valid guild_counts
console.log("\nTest 11: Valid guild_counts");
const gc1 = validateGuildCounts(
    { "guild-A": 2, "guild-B": 1 },
    students
);
assert(gc1.valid === true, "Should accept correct guild_counts");

// Test 12: Invalid guild_counts (wrong count)
console.log("\nTest 12: Invalid guild_counts (wrong count)");
const gc2 = validateGuildCounts(
    { "guild-A": 3, "guild-B": 1 },
    students
);
assert(gc2.valid === false, "Should reject wrong count");

// Test 13: Invalid guild_counts (extra guild)
console.log("\nTest 13: Invalid guild_counts (extra guild)");
const gc3 = validateGuildCounts(
    { "guild-A": 2, "guild-B": 1, "guild-C": 0 },
    students
);
assert(gc3.valid === false, "Should reject extra guild");

// Test 14: Invalid guild_counts (missing guild)
console.log("\nTest 14: Invalid guild_counts (missing guild)");
const gc4 = validateGuildCounts(
    { "guild-A": 2 },
    students
);
assert(gc4.valid === false, "Should reject missing guild");

// Test 15: Valid guild_counts (empty)
console.log("\nTest 15: Valid guild_counts (empty)");
const gc5 = validateGuildCounts({}, []);
assert(gc5.valid === true, "Should accept empty guild_counts for empty students");

console.log("\n=== Tests Complete ===\n");

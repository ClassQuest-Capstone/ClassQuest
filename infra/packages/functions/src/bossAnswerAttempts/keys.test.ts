/**
 * Key building tests for BossAnswerAttempts
 *
 * Run with: node --loader tsx keys.test.ts
 */

import {
    buildBossAttemptPk,
    buildAttemptSk,
    buildGsi2Sk,
    buildGsi3Pk,
    buildGsi3Sk,
} from "./keys.js";

// Test helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== BossAnswerAttempts Key Building Tests ===\n");

// Test 1: Build boss_attempt_pk
console.log("Test 1: Build boss_attempt_pk");
const pk1 = buildBossAttemptPk("battle-123", "question-456");
assert(
    pk1 === "BI#battle-123#Q#question-456",
    "Should build correct boss_attempt_pk"
);
console.log(`  Result: ${pk1}`);

// Test 2: Build attempt_sk
console.log("\nTest 2: Build attempt_sk");
const timestamp = "2026-02-24T12:00:00.000Z";
const sk1 = buildAttemptSk(timestamp, "student-789", "test-uuid-123");
assert(
    sk1 === "T#2026-02-24T12:00:00.000Z#S#student-789#A#test-uuid-123",
    "Should build correct attempt_sk"
);
console.log(`  Result: ${sk1}`);

// Test 3: Build attempt_sk with auto UUID
console.log("\nTest 3: Build attempt_sk with auto UUID");
const sk2 = buildAttemptSk(timestamp, "student-789");
assert(sk2.startsWith("T#2026-02-24T12:00:00.000Z#S#student-789#A#"), "Should start with correct prefix");
assert(sk2.length > "T#2026-02-24T12:00:00.000Z#S#student-789#A#".length, "Should include UUID");
console.log(`  Result: ${sk2}`);

// Test 4: Build GSI2 sort key
console.log("\nTest 4: Build GSI2 sort key");
const gsi2Sk = buildGsi2Sk(timestamp, "battle-123", "question-456");
assert(
    gsi2Sk === "2026-02-24T12:00:00.000Z#battle-123#question-456",
    "Should build correct GSI2 sort key"
);
console.log(`  Result: ${gsi2Sk}`);

// Test 5: Build GSI3 partition key
console.log("\nTest 5: Build GSI3 partition key");
const gsi3Pk = buildGsi3Pk("battle-123", "student-789");
assert(
    gsi3Pk === "battle-123#student-789",
    "Should build correct GSI3 partition key"
);
console.log(`  Result: ${gsi3Pk}`);

// Test 6: Build GSI3 sort key
console.log("\nTest 6: Build GSI3 sort key");
const gsi3Sk = buildGsi3Sk(timestamp, "question-456");
assert(
    gsi3Sk === "2026-02-24T12:00:00.000Z#question-456",
    "Should build correct GSI3 sort key"
);
console.log(`  Result: ${gsi3Sk}`);

// Test 7: Verify sort order (attempt_sk)
console.log("\nTest 7: Verify sort order (attempt_sk)");
const sk3 = buildAttemptSk("2026-02-24T12:00:00.000Z", "student-A", "uuid-1");
const sk4 = buildAttemptSk("2026-02-24T12:01:00.000Z", "student-B", "uuid-2");
assert(sk3 < sk4, "Earlier timestamp should sort before later timestamp");
console.log(`  SK1: ${sk3}`);
console.log(`  SK2: ${sk4}`);
console.log(`  SK1 < SK2: ${sk3 < sk4}`);

console.log("\n=== Tests Complete ===\n");

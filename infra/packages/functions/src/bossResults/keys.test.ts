/**
 * Key building tests for BossResults
 *
 * Run with: node --loader tsx keys.test.ts
 */

import {
    buildBossResultPk,
    buildStudentResultSk,
    buildGuildResultSk,
    buildMetaResultSk,
    buildGsi1Sk,
    buildGsi2Sk,
    isStudentRow,
    isGuildRow,
    isMetaRow,
} from "./keys.js";

// Test helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== BossResults Key Building Tests ===\n");

// Test 1: Build boss_result_pk
console.log("Test 1: Build boss_result_pk");
const pk1 = buildBossResultPk("battle-123");
assert(pk1 === "BI#battle-123", "Should build correct PK");
console.log(`  Result: ${pk1}`);

// Test 2: Build student result SK
console.log("\nTest 2: Build student result SK");
const sk1 = buildStudentResultSk("student-456");
assert(sk1 === "STU#student-456", "Should build correct student SK");
console.log(`  Result: ${sk1}`);

// Test 3: Build guild result SK
console.log("\nTest 3: Build guild result SK");
const sk2 = buildGuildResultSk("guild-789");
assert(sk2 === "GUILD#guild-789", "Should build correct guild SK");
console.log(`  Result: ${sk2}`);

// Test 4: Build meta result SK
console.log("\nTest 4: Build meta result SK");
const sk3 = buildMetaResultSk();
assert(sk3 === "META", "Should build correct meta SK");
console.log(`  Result: ${sk3}`);

// Test 5: Build GSI1 sort key
console.log("\nTest 5: Build GSI1 sort key");
const gsi1Sk = buildGsi1Sk("2026-02-24T12:00:00.000Z", "battle-123");
assert(
    gsi1Sk === "2026-02-24T12:00:00.000Z#battle-123",
    "Should build correct GSI1 SK"
);
console.log(`  Result: ${gsi1Sk}`);

// Test 6: Build GSI2 sort key
console.log("\nTest 6: Build GSI2 sort key");
const gsi2Sk = buildGsi2Sk("2026-02-24T12:00:00.000Z", "battle-123");
assert(
    gsi2Sk === "2026-02-24T12:00:00.000Z#battle-123",
    "Should build correct GSI2 SK"
);
console.log(`  Result: ${gsi2Sk}`);

// Test 7: isStudentRow
console.log("\nTest 7: isStudentRow");
assert(isStudentRow("STU#student-456") === true, "Should identify student row");
assert(isStudentRow("GUILD#guild-789") === false, "Should not identify guild row as student");
assert(isStudentRow("META") === false, "Should not identify meta row as student");

// Test 8: isGuildRow
console.log("\nTest 8: isGuildRow");
assert(isGuildRow("GUILD#guild-789") === true, "Should identify guild row");
assert(isGuildRow("STU#student-456") === false, "Should not identify student row as guild");
assert(isGuildRow("META") === false, "Should not identify meta row as guild");

// Test 9: isMetaRow
console.log("\nTest 9: isMetaRow");
assert(isMetaRow("META") === true, "Should identify meta row");
assert(isMetaRow("STU#student-456") === false, "Should not identify student row as meta");
assert(isMetaRow("GUILD#guild-789") === false, "Should not identify guild row as meta");

// Test 10: Sort order verification
console.log("\nTest 10: Sort order verification");
const stuSk1 = buildStudentResultSk("student-A");
const stuSk2 = buildStudentResultSk("student-B");
assert(stuSk1 < stuSk2, "Student rows should sort alphabetically");
console.log(`  STU#student-A < STU#student-B: ${stuSk1 < stuSk2}`);

const guildSk1 = buildGuildResultSk("guild-A");
const metaSk = buildMetaResultSk();
assert(guildSk1 < metaSk, "GUILD rows should sort before META");
console.log(`  GUILD#guild-A < META: ${guildSk1 < metaSk}`);

console.log("\n=== Tests Complete ===\n");

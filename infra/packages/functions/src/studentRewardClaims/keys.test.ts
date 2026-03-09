/**
 * Tests for StudentRewardClaims key helpers (buildClaimSort)
 *
 * Run with: node --import tsx keys.test.ts
 */

import { buildClaimSort } from "./keys.ts";

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== StudentRewardClaims keys.test.ts ===\n");

// Test 1: AVAILABLE sort key format
console.log("Test 1: AVAILABLE sort key");
const sk1 = buildClaimSort("AVAILABLE", "class_123", 5, "reward_helmet_lvl5");
assert(
    sk1 === "AVAILABLE#class_123#00005#reward_helmet_lvl5",
    "AVAILABLE sort key format is correct"
);

// Test 2: CLAIMED sort key format
console.log("\nTest 2: CLAIMED sort key");
const sk2 = buildClaimSort("CLAIMED", "class_123", 5, "reward_helmet_lvl5");
assert(
    sk2 === "CLAIMED#class_123#00005#reward_helmet_lvl5",
    "CLAIMED sort key format is correct"
);

// Test 3: Level zero-padding (level 10)
console.log("\nTest 3: Level zero-padding");
const sk3 = buildClaimSort("AVAILABLE", "class_abc", 10, "reward_xyz");
assert(
    sk3 === "AVAILABLE#class_abc#00010#reward_xyz",
    "Level 10 is zero-padded to 5 digits"
);

// Test 4: Level 1 (minimum)
console.log("\nTest 4: Level 1 (minimum)");
const sk4 = buildClaimSort("AVAILABLE", "class_abc", 1, "reward_xyz");
assert(
    sk4 === "AVAILABLE#class_abc#00001#reward_xyz",
    "Level 1 is zero-padded correctly"
);

// Test 5: High level (100)
console.log("\nTest 5: High level (100)");
const sk5 = buildClaimSort("AVAILABLE", "class_abc", 100, "reward_xyz");
assert(
    sk5 === "AVAILABLE#class_abc#00100#reward_xyz",
    "Level 100 is zero-padded correctly"
);

// Test 6: AVAILABLE sorts before CLAIMED lexicographically
console.log("\nTest 6: AVAILABLE before CLAIMED (lexicographic order)");
const availableKey = buildClaimSort("AVAILABLE", "class_abc", 5, "r1");
const claimedKey   = buildClaimSort("CLAIMED",   "class_abc", 5, "r1");
assert(
    availableKey < claimedKey,
    "AVAILABLE sorts before CLAIMED lexicographically"
);

// Test 7: Lower level sorts before higher level (same status + class)
console.log("\nTest 7: Lower level before higher level");
const level5Key  = buildClaimSort("AVAILABLE", "class_abc", 5, "r1");
const level10Key = buildClaimSort("AVAILABLE", "class_abc", 10, "r1");
assert(
    level5Key < level10Key,
    "Level 5 sorts before level 10"
);

// Test 8: Same status+class+level: sort is stable by reward_id
console.log("\nTest 8: Reward ID tiebreaker");
const keyA = buildClaimSort("AVAILABLE", "class_abc", 5, "reward_aaa");
const keyB = buildClaimSort("AVAILABLE", "class_abc", 5, "reward_bbb");
assert(keyA < keyB, "reward_aaa sorts before reward_bbb at same status/class/level");

console.log("\n=== Tests Complete ===\n");

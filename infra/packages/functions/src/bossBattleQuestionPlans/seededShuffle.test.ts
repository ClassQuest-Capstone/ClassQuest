/**
 * Tests for seeded shuffle determinism
 *
 * Run with: node --loader tsx seededShuffle.test.ts
 */

import { seededShuffle, deriveGuildSeed } from "./seededShuffle.js";

// Test helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== Seeded Shuffle Tests ===\n");

// Test 1: Same seed produces same order
console.log("Test 1: Same seed produces same order (determinism)");
const array1 = ["A", "B", "C", "D", "E", "F"];
const seed1 = "test-seed-123";

const result1a = seededShuffle(array1, seed1);
const result1b = seededShuffle(array1, seed1);

assert(
    JSON.stringify(result1a) === JSON.stringify(result1b),
    "Same seed should produce identical shuffle"
);
console.log(`  Shuffled: ${result1a.join(", ")}`);

// Test 2: Different seeds produce different orders
console.log("\nTest 2: Different seeds produce different orders");
const seed2a = "seed-A";
const seed2b = "seed-B";

const result2a = seededShuffle(array1, seed2a);
const result2b = seededShuffle(array1, seed2b);

assert(
    JSON.stringify(result2a) !== JSON.stringify(result2b),
    "Different seeds should produce different shuffles"
);
console.log(`  Seed A: ${result2a.join(", ")}`);
console.log(`  Seed B: ${result2b.join(", ")}`);

// Test 3: Shuffle preserves all elements
console.log("\nTest 3: Shuffle preserves all elements");
const original = ["Q1", "Q2", "Q3", "Q4", "Q5"];
const shuffled = seededShuffle(original, "test-seed");

const originalSorted = [...original].sort();
const shuffledSorted = [...shuffled].sort();

assert(
    JSON.stringify(originalSorted) === JSON.stringify(shuffledSorted),
    "Shuffled array should contain all original elements"
);
console.log(`  Original: ${original.join(", ")}`);
console.log(`  Shuffled: ${shuffled.join(", ")}`);

// Test 4: Empty array
console.log("\nTest 4: Empty array");
const empty: string[] = [];
const shuffledEmpty = seededShuffle(empty, "seed");
assert(shuffledEmpty.length === 0, "Empty array should remain empty");

// Test 5: Single element
console.log("\nTest 5: Single element");
const single = ["ONLY"];
const shuffledSingle = seededShuffle(single, "seed");
assert(
    shuffledSingle.length === 1 && shuffledSingle[0] === "ONLY",
    "Single element should remain unchanged"
);

// Test 6: Guild seed derivation is consistent
console.log("\nTest 6: Guild seed derivation is consistent");
const baseSeed = "base-seed-123";
const guildId = "guild-A";

const guildSeed1 = deriveGuildSeed(baseSeed, guildId);
const guildSeed2 = deriveGuildSeed(baseSeed, guildId);

assert(
    guildSeed1 === guildSeed2,
    "Deriving guild seed should be deterministic"
);
console.log(`  Guild seed: ${guildSeed1}`);

// Test 7: Different guilds get different seeds
console.log("\nTest 7: Different guilds get different seeds");
const guildSeedA = deriveGuildSeed(baseSeed, "guild-A");
const guildSeedB = deriveGuildSeed(baseSeed, "guild-B");

assert(
    guildSeedA !== guildSeedB,
    "Different guilds should get different derived seeds"
);
console.log(`  Guild A seed: ${guildSeedA}`);
console.log(`  Guild B seed: ${guildSeedB}`);

// Test 8: Different guild seeds produce different shuffles
console.log("\nTest 8: Different guild seeds produce different shuffles");
const questions = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"];

const guildASeeded = deriveGuildSeed("master-seed", "guild-A");
const guildBSeeded = deriveGuildSeed("master-seed", "guild-B");

const guildAQuestions = seededShuffle(questions, guildASeeded);
const guildBQuestions = seededShuffle(questions, guildBSeeded);

assert(
    JSON.stringify(guildAQuestions) !== JSON.stringify(guildBQuestions),
    "Different guilds should get different question orders"
);
console.log(`  Guild A: ${guildAQuestions.join(", ")}`);
console.log(`  Guild B: ${guildBQuestions.join(", ")}`);

// Test 9: Reproducibility across multiple runs
console.log("\nTest 9: Reproducibility across multiple runs");
const testSeed = "reproducible-seed";
const testArray = ["1", "2", "3", "4", "5", "6", "7", "8"];

const run1 = seededShuffle(testArray, testSeed);
const run2 = seededShuffle(testArray, testSeed);
const run3 = seededShuffle(testArray, testSeed);

assert(
    JSON.stringify(run1) === JSON.stringify(run2) &&
    JSON.stringify(run2) === JSON.stringify(run3),
    "Multiple runs with same seed should produce identical results"
);
console.log(`  All runs: ${run1.join(", ")}`);

console.log("\n=== Tests Complete ===\n");

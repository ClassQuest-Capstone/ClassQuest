/**
 * analyze-test-folder.ts
 *
 * Inspects a backend Lambda source folder and prints a compact JSON summary
 * that can be fed to Claude instead of pasting raw source code.
 *
 * Usage:
 *   node --import tsx scripts/analyze-test-folder.ts <folder-path>
 *
 * Examples:
 *   node --import tsx scripts/analyze-test-folder.ts src/bossResults
 *   node --import tsx scripts/analyze-test-folder.ts infra/packages/functions/src/studentRewardClaims
 *
 * Output fields:
 *   folder              — resolved folder path
 *   sourceFiles         — all .ts files at the folder root (not in __tests__)
 *   existingTestFiles   — files inside __tests__/ (Vitest picks these up)
 *   manualTestScripts   — root-level *.test.ts files (NOT Vitest — manual scripts only)
 *   fileKinds           — inferred kind for each source file
 *   likelyUntestedFiles — source files with no matching __tests__ coverage
 *   recommendedTestTargets — which files should get new __tests__/ coverage
 *   notes               — any observations worth flagging
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FUNCTIONS_ROOT = path.resolve("infra/packages/functions/src");

const KIND_MAP: Record<string, string> = {
    "repo.ts":        "repo",
    "validation.ts":  "validation",
    "types.ts":       "types",
    "keys.ts":        "keys",
    "handler.ts":     "handler",
    "index.ts":       "index",
    "README.md":      "readme",
};

const SKIP_KINDS = new Set(["types", "readme", "keys"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferKind(filename: string): string {
    if (KIND_MAP[filename]) return KIND_MAP[filename];
    if (filename.endsWith(".test.ts")) return "manual-test-script";
    if (filename.endsWith(".ts")) {
        // Heuristics by filename
        if (/^(create|get|update|delete|list|join|kick|leave|spectate|start|finish|submit|resolve|advance|countdown|soft-delete|get-plan|set-)/.test(filename)) return "handler";
        if (/^(publish|notify|emit)/.test(filename)) return "publisher";
        if (/^(seed|migrate)/.test(filename)) return "script";
    }
    return "other";
}

function getSourceFiles(folderPath: string): string[] {
    return fs.readdirSync(folderPath)
        .filter(f => !fs.statSync(path.join(folderPath, f)).isDirectory())
        .sort();
}

function getTestFiles(folderPath: string): string[] {
    const testsDir = path.join(folderPath, "__tests__");
    if (!fs.existsSync(testsDir)) return [];
    return fs.readdirSync(testsDir)
        .filter(f => f.endsWith(".test.ts"))
        .sort();
}

function coveredByTests(sourceFile: string, testFiles: string[], fileKind: string): boolean {
    // A test file covers a source file if its name contains the source file's base name
    const base = sourceFile.replace(/\.ts$/, "");
    if (testFiles.some(t => t.includes(base))) return true;
    // handlers.test.ts is a common pattern for covering all handler files in one test file
    if (fileKind === "handler" && testFiles.some(t => t.includes("handler"))) return true;
    return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const arg = process.argv[2];
if (!arg) {
    console.error("Usage: node --import tsx scripts/analyze-test-folder.ts <folder-path>");
    process.exit(1);
}

// Resolve folder — accept both absolute and relative paths, or bare folder name
let folderPath = arg;
if (!path.isAbsolute(folderPath)) {
    // Try relative to cwd first, then relative to functions root
    const fromCwd = path.resolve(folderPath);
    const fromFunctionsRoot = path.join(FUNCTIONS_ROOT, folderPath.replace(/^src\//, ""));
    folderPath = fs.existsSync(fromCwd) ? fromCwd : fromFunctionsRoot;
}

if (!fs.existsSync(folderPath)) {
    console.error(`Folder not found: ${folderPath}`);
    process.exit(1);
}

const allFiles      = getSourceFiles(folderPath);
const sourceFiles   = allFiles.filter(f => !f.endsWith(".test.ts") && !f.endsWith(".md") && !f.startsWith("."));
const manualScripts = allFiles.filter(f => f.endsWith(".test.ts"));
const testFiles     = getTestFiles(folderPath);

const fileKinds: Record<string, string> = {};
for (const f of sourceFiles) {
    fileKinds[f] = inferKind(f);
}

const likelyUntestedFiles = sourceFiles.filter(f => {
    const kind = fileKinds[f];
    if (SKIP_KINDS.has(kind)) return false;
    if (kind === "manual-test-script") return false;
    return !coveredByTests(f, testFiles, kind);
});

const recommendedTestTargets = likelyUntestedFiles.filter(f => {
    const kind = fileKinds[f];
    return ["repo", "handler", "publisher", "validation", "resolver", "other"].includes(kind);
});

const notes: string[] = [];
if (manualScripts.length > 0) {
    notes.push(`Manual test scripts at folder root (NOT Vitest): ${manualScripts.join(", ")} — inspect before writing new tests to avoid duplication`);
}
if (testFiles.length === 0 && sourceFiles.length > 0) {
    notes.push("No __tests__/ directory found — this folder has zero Vitest coverage");
}
if (testFiles.length > 0 && likelyUntestedFiles.length === 0) {
    notes.push("All non-trivial source files appear to have __tests__/ coverage — verify before adding more");
}
if (sourceFiles.some(f => f === "validation.ts") && manualScripts.some(f => f === "validation.test.ts")) {
    notes.push("validation.ts has a manual script — __tests__/validation.test.ts is only needed if manual script coverage is insufficient");
}

const summary = {
    folder: folderPath,
    sourceFiles,
    existingTestFiles: testFiles.map(f => `__tests__/${f}`),
    manualTestScripts: manualScripts,
    fileKinds,
    likelyUntestedFiles,
    recommendedTestTargets,
    notes,
};

console.log(JSON.stringify(summary, null, 2));

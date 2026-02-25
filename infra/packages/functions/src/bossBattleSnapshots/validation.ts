/**
 * Validation functions for BossBattleSnapshots
 */

import { SnapshotParticipant } from "./types.js";

export type ValidationResult =
    | { valid: true }
    | { valid: false; error: string };

/**
 * Validate snapshot participant entry
 */
export function validateParticipant(
    participant: any
): ValidationResult {
    if (!participant || typeof participant !== "object") {
        return {
            valid: false,
            error: "Participant must be an object",
        };
    }

    if (typeof participant.student_id !== "string" || !participant.student_id) {
        return {
            valid: false,
            error: "Participant must have student_id string",
        };
    }

    if (typeof participant.guild_id !== "string" || !participant.guild_id) {
        return {
            valid: false,
            error: "Participant must have guild_id string",
        };
    }

    return { valid: true };
}

/**
 * Validate joined_students list
 */
export function validateJoinedStudents(
    joinedStudents: any
): ValidationResult {
    if (!Array.isArray(joinedStudents)) {
        return {
            valid: false,
            error: "joined_students must be an array",
        };
    }

    // Allow empty for now (might want to block countdown elsewhere)
    if (joinedStudents.length === 0) {
        return { valid: true };
    }

    for (let i = 0; i < joinedStudents.length; i++) {
        const result = validateParticipant(joinedStudents[i]);
        if (!result.valid) {
            return {
                valid: false,
                error: `joined_students[${i}]: ${result.error}`,
            };
        }
    }

    return { valid: true };
}

/**
 * Validate joined_count matches list length
 */
export function validateJoinedCount(
    joinedCount: any,
    joinedStudents: SnapshotParticipant[]
): ValidationResult {
    if (typeof joinedCount !== "number" || joinedCount < 0) {
        return {
            valid: false,
            error: "joined_count must be a non-negative number",
        };
    }

    if (joinedCount !== joinedStudents.length) {
        return {
            valid: false,
            error: `joined_count (${joinedCount}) does not match joined_students length (${joinedStudents.length})`,
        };
    }

    return { valid: true };
}

/**
 * Validate guild_counts
 */
export function validateGuildCounts(
    guildCounts: any,
    joinedStudents: SnapshotParticipant[]
): ValidationResult {
    if (!guildCounts || typeof guildCounts !== "object" || Array.isArray(guildCounts)) {
        return {
            valid: false,
            error: "guild_counts must be an object/map",
        };
    }

    // Compute expected guild counts
    const expected: Record<string, number> = {};
    for (const participant of joinedStudents) {
        expected[participant.guild_id] = (expected[participant.guild_id] || 0) + 1;
    }

    // Validate each guild count
    for (const guildId of Object.keys(expected)) {
        if (guildCounts[guildId] !== expected[guildId]) {
            return {
                valid: false,
                error: `guild_counts[${guildId}] is ${guildCounts[guildId]}, expected ${expected[guildId]}`,
            };
        }
    }

    // Check for extra guilds in guildCounts
    for (const guildId of Object.keys(guildCounts)) {
        if (!expected[guildId]) {
            return {
                valid: false,
                error: `guild_counts contains unexpected guild ${guildId}`,
            };
        }
    }

    return { valid: true };
}

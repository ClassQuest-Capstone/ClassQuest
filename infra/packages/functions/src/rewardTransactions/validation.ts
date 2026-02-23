import { SourceType, CreatedByRole } from "./types.js";

/**
 * Validate transaction_id format and length
 */
export function validateTransactionId(transaction_id: string): { valid: boolean; error?: string } {
    if (!transaction_id || typeof transaction_id !== "string") {
        return { valid: false, error: "transaction_id must be a non-empty string" };
    }
    if (transaction_id.length > 200) {
        return { valid: false, error: "transaction_id must be <= 200 characters" };
    }
    return { valid: true };
}

/**
 * Validate source_type enum
 */
export function validateSourceType(source_type: string): { valid: boolean; error?: string } {
    const validTypes = Object.values(SourceType);
    if (!validTypes.includes(source_type as SourceType)) {
        return {
            valid: false,
            error: `source_type must be one of: ${validTypes.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate created_by_role enum
 */
export function validateCreatedByRole(role: string): { valid: boolean; error?: string } {
    const validRoles = Object.values(CreatedByRole);
    if (!validRoles.includes(role as CreatedByRole)) {
        return {
            valid: false,
            error: `created_by_role must be one of: ${validRoles.join(", ")}`,
        };
    }
    return { valid: true };
}

/**
 * Validate that at least one delta is non-zero
 */
export function validateDeltas(
    xp_delta: number,
    gold_delta: number,
    hearts_delta: number
): { valid: boolean; error?: string } {
    // Check all are numbers
    if (typeof xp_delta !== "number" || typeof gold_delta !== "number" || typeof hearts_delta !== "number") {
        return { valid: false, error: "xp_delta, gold_delta, and hearts_delta must be numbers" };
    }

    // Check that at least one is non-zero
    if (xp_delta === 0 && gold_delta === 0 && hearts_delta === 0) {
        return {
            valid: false,
            error: "At least one of xp_delta, gold_delta, or hearts_delta must be non-zero",
        };
    }

    return { valid: true };
}

/**
 * Validate source linkage based on source_type
 */
export function validateSourceLinkage(data: {
    source_type: SourceType;
    quest_instance_id?: string;
    question_id?: string;
    boss_battle_instance_id?: string;
    source_id?: string;
}): { valid: boolean; error?: string } {
    const { source_type, quest_instance_id, question_id, boss_battle_instance_id } = data;

    if (source_type === SourceType.QUEST_QUESTION) {
        if (!quest_instance_id || !question_id) {
            return {
                valid: false,
                error: "QUEST_QUESTION requires quest_instance_id and question_id",
            };
        }
    }

    if (source_type === SourceType.BOSS_BATTLE) {
        if (!boss_battle_instance_id) {
            return {
                valid: false,
                error: "BOSS_BATTLE requires boss_battle_instance_id",
            };
        }
    }

    return { valid: true };
}

/**
 * Validate complete transaction data
 */
export function validateTransactionData(data: {
    transaction_id: string;
    student_id?: string;
    xp_delta: number;
    gold_delta: number;
    hearts_delta: number;
    source_type: string;
    created_at?: string;
    created_by?: string;
    created_by_role?: string;
    quest_instance_id?: string;
    question_id?: string;
    boss_battle_instance_id?: string;
}): { valid: boolean; error?: string } {
    // Validate transaction_id
    const txnValidation = validateTransactionId(data.transaction_id);
    if (!txnValidation.valid) return txnValidation;

    // Validate student_id
    if (!data.student_id || typeof data.student_id !== "string") {
        return { valid: false, error: "student_id is required" };
    }

    // Validate deltas
    const deltasValidation = validateDeltas(data.xp_delta, data.gold_delta, data.hearts_delta);
    if (!deltasValidation.valid) return deltasValidation;

    // Validate source_type
    const sourceTypeValidation = validateSourceType(data.source_type);
    if (!sourceTypeValidation.valid) return sourceTypeValidation;

    // Validate source linkage
    const linkageValidation = validateSourceLinkage({
        source_type: data.source_type as SourceType,
        quest_instance_id: data.quest_instance_id,
        question_id: data.question_id,
        boss_battle_instance_id: data.boss_battle_instance_id,
    });
    if (!linkageValidation.valid) return linkageValidation;

    // Validate created_at
    if (!data.created_at) {
        return { valid: false, error: "created_at is required" };
    }

    // Validate created_by
    if (!data.created_by || typeof data.created_by !== "string") {
        return { valid: false, error: "created_by is required" };
    }

    // Validate created_by_role
    if (data.created_by_role) {
        const roleValidation = validateCreatedByRole(data.created_by_role);
        if (!roleValidation.valid) return roleValidation;
    }

    return { valid: true };
}

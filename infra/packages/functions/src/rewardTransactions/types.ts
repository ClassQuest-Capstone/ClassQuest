export enum SourceType {
    QUEST_QUESTION = "QUEST_QUESTION",
    QUEST_COMPLETION = "QUEST_COMPLETION",
    BOSS_BATTLE = "BOSS_BATTLE",
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT",
    SYSTEM_ADJUSTMENT = "SYSTEM_ADJUSTMENT"
}

export enum CreatedByRole {
    TEACHER = "TEACHER",
    ADMIN = "ADMIN",
    SYSTEM = "SYSTEM"
}

export type RewardTransactionItem = {
    // Primary key
    transaction_id: string;

    // Core fields
    student_id: string;
    class_id?: string;
    xp_delta: number;
    gold_delta: number;
    hearts_delta: number;

    // Source linkage
    source_type: SourceType;
    source_id?: string;
    quest_instance_id?: string;
    question_id?: string;
    boss_battle_instance_id?: string;
    attempt_pk?: string;

    // Metadata
    reason?: string;
    created_at: string;
    created_by: string;
    created_by_role: CreatedByRole;
    metadata?: Record<string, any>;

    // GSI keys
    gsi1_pk: string;   // S#<student_id>
    gsi1_sk: string;   // T#<created_at>#TX#<transaction_id>
    gsi2_pk?: string;  // C#<class_id>#S#<student_id>
    gsi2_sk?: string;  // T#<created_at>#TX#<transaction_id>
    gsi3_pk?: string;  // SRC#<source_type>#<source_id>
    gsi3_sk?: string;  // T#<created_at>#S#<student_id>#TX#<transaction_id>
};

/**
 * Compute GSI keys for a transaction
 */
export function computeGSIKeys(item: {
    student_id: string;
    class_id?: string;
    source_type: SourceType;
    source_id?: string;
    created_at: string;
    transaction_id: string;
}): {
    gsi1_pk: string;
    gsi1_sk: string;
    gsi2_pk?: string;
    gsi2_sk?: string;
    gsi3_pk?: string;
    gsi3_sk?: string;
} {
    const gsi1_pk = `S#${item.student_id}`;
    const gsi1_sk = `T#${item.created_at}#TX#${item.transaction_id}`;

    let gsi2_pk: string | undefined;
    let gsi2_sk: string | undefined;
    if (item.class_id) {
        gsi2_pk = `C#${item.class_id}#S#${item.student_id}`;
        gsi2_sk = `T#${item.created_at}#TX#${item.transaction_id}`;
    }

    let gsi3_pk: string | undefined;
    let gsi3_sk: string | undefined;
    if (item.source_id) {
        gsi3_pk = `SRC#${item.source_type}#${item.source_id}`;
        gsi3_sk = `T#${item.created_at}#S#${item.student_id}#TX#${item.transaction_id}`;
    }

    return { gsi1_pk, gsi1_sk, gsi2_pk, gsi2_sk, gsi3_pk, gsi3_sk };
}

/**
 * Generate deterministic transaction_id for idempotent sources
 */
export function generateDeterministicTransactionId(
    source_type: SourceType,
    quest_instance_id?: string,
    student_id?: string,
    question_id?: string,
    boss_battle_instance_id?: string
): string {
    if (source_type === SourceType.QUEST_QUESTION && quest_instance_id && student_id && question_id) {
        return `QUESTQ#${quest_instance_id}#${student_id}#${question_id}`;
    }
    if (source_type === SourceType.BOSS_BATTLE && boss_battle_instance_id && student_id) {
        return `BOSS#${boss_battle_instance_id}#${student_id}`;
    }
    // For other sources, caller should provide UUID
    throw new Error(`Cannot generate deterministic ID for source_type: ${source_type}`);
}

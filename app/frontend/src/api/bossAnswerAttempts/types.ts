/**
 * Boss Answer Attempts type definitions
 */

export type BossAnswerAttempt = {
    composite_pk: string; // BI#<boss_instance_id>#Q#<question_id>
    composite_sk: string; // T#<answered_at>#S#<student_id>#A#<uuid>
    boss_instance_id: string;
    question_id: string;
    student_id: string;
    guild_id: string;
    student_answer: string;
    is_correct: boolean;
    answered_at: string; // ISO timestamp
    time_to_answer_ms: number;
    speed_multiplier: number;
    damage_dealt: number;
    hearts_lost: number;
    question_difficulty?: number;
    created_at: string; // ISO timestamp
};

export type BossAnswerAttemptsList = {
    items: BossAnswerAttempt[];
    cursor?: string;
};

/**
 * Boss Results type definitions
 */

export type BossResultMeta = {
    boss_instance_id: string; // PK
    item_type: "META"; // SK
    computed_at: string; // ISO timestamp
    computed_by_teacher_id: string;
    outcome: "WIN" | "FAIL" | "ABORTED";
    fail_reason?: "TIMEOUT" | "ALL_GUILDS_DOWN" | "OUT_OF_QUESTIONS" | "ABORTED_BY_TEACHER";
    total_students: number;
    total_guilds: number;
    total_damage_dealt: number;
    boss_hp_remaining: number;
    total_hearts_lost: number;
    total_questions_answered: number;
    battle_duration_seconds: number;
    version: number;
};

export type BossResultStudent = {
    boss_instance_id: string; // PK
    item_type: string; // SK: STU#<student_id>
    student_id: string;
    guild_id: string;
    questions_answered: number;
    correct_answers: number;
    incorrect_answers: number;
    total_damage_dealt: number;
    hearts_lost: number;
    avg_time_to_answer_ms: number;
    avg_speed_multiplier: number;
    xp_earned: number;
    gold_earned: number;
};

export type BossResultGuild = {
    boss_instance_id: string; // PK
    item_type: string; // SK: GUILD#<guild_id>
    guild_id: string;
    members_count: number;
    questions_answered: number;
    correct_answers: number;
    incorrect_answers: number;
    total_damage_dealt: number;
    hearts_lost: number;
    avg_time_to_answer_ms: number;
    avg_speed_multiplier: number;
    xp_earned: number;
    gold_earned: number;
};

export type BossResultsResponse = {
    meta: BossResultMeta;
    students: BossResultStudent[];
    guilds: BossResultGuild[];
};

export type BossResultStudentList = {
    items: BossResultStudent[];
    cursor?: string;
};

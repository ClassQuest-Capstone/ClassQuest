export function makeInstanceStudentPk(quest_instance_id: string, student_id: string): string {
    return `${quest_instance_id}#${student_id}`;
}

export function makeGsi1Sk(submitted_at: string, student_id: string, question_id: string): string {
    return `${submitted_at}#${student_id}#${question_id}`;
}

export function makeGsi2Sk(submitted_at: string, quest_instance_id: string, question_id: string): string {
    return `${submitted_at}#${quest_instance_id}#${question_id}`;
}

export function makeGsi3Sk(submitted_at: string, student_id: string, quest_instance_id: string): string {
    return `${submitted_at}#${student_id}#${quest_instance_id}`;
}

import { api } from "../http.js";
import type { BossAnswerAttemptsList } from "./types.js";

/**
 * List boss answer attempts by battle instance
 * GET /boss-battle-instances/{boss_instance_id}/attempts
 */
export function listBossAnswerAttemptsByBattle(
    bossInstanceId: string,
    options?: {
        limit?: number;
        cursor?: string;
    }
) {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<BossAnswerAttemptsList>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/attempts${qs ? `?${qs}` : ""}`
    );
}

/**
 * List boss answer attempts by student
 * GET /students/{student_id}/bossAttempts
 */
export function listBossAnswerAttemptsByStudent(
    studentId: string,
    options?: {
        limit?: number;
        cursor?: string;
    }
) {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<BossAnswerAttemptsList>(
        `/students/${encodeURIComponent(studentId)}/bossAttempts${qs ? `?${qs}` : ""}`
    );
}

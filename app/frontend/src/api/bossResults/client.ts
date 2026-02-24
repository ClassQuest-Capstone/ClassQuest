import { api } from "../http.js";
import type { BossResultsResponse, BossResultStudentList } from "./types.js";

/**
 * Get boss battle results
 * GET /boss-battle-instances/{boss_instance_id}/results
 */
export function getBossResults(bossInstanceId: string) {
    return api<BossResultsResponse>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/results`
    );
}

/**
 * List boss results by student
 * GET /students/{student_id}/bossResults
 */
export function listBossResultsByStudent(
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
    return api<BossResultStudentList>(
        `/students/${encodeURIComponent(studentId)}/bossResults${qs ? `?${qs}` : ""}`
    );
}

/**
 * Compute boss battle results (teacher only)
 * POST /boss-battle-instances/{boss_instance_id}/results/compute
 */
export function computeBossResults(bossInstanceId: string) {
    return api<{ message: string; computed_at: string }>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}/results/compute`,
        {
            method: "POST",
        }
    );
}

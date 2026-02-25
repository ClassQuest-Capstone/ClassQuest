import { api } from "../http.js";
import type {
    BossBattleInstance,
    CreateBossBattleInstanceInput,
    UpdateBossBattleInstanceInput,
    PaginatedBossBattleInstances,
} from "./types.js";

/**
 * Create a new boss battle instance
 * POST /boss-battle-instances
 */
export function createBossBattleInstance(input: CreateBossBattleInstanceInput) {
    return api<{
        message: string;
        boss_instance_id: string;
        status: string;
    }>("/boss-battle-instances", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/**
 * Get a boss battle instance by ID
 * GET /boss-battle-instances/{boss_instance_id}
 */
export function getBossBattleInstance(bossInstanceId: string) {
    return api<BossBattleInstance>(
        `/boss-battle-instances/${encodeURIComponent(bossInstanceId)}`
    );
}

/**
 * List boss battle instances by class
 * GET /classes/{class_id}/boss-battle-instances
 */
export function listBossBattleInstancesByClass(
    classId: string,
    options?: {
        limit?: number;
        cursor?: string;
    }
) {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedBossBattleInstances>(
        `/classes/${encodeURIComponent(classId)}/boss-battle-instances${qs ? `?${qs}` : ""}`
    );
}

/**
 * List boss battle instances by template
 * GET /boss-battle-templates/{boss_template_id}/boss-battle-instances
 */
export function listBossBattleInstancesByTemplate(
    bossTemplateId: string,
    options?: {
        limit?: number;
        cursor?: string;
    }
) {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.cursor) params.append("cursor", options.cursor);

    const qs = params.toString();
    return api<PaginatedBossBattleInstances>(
        `/boss-battle-templates/${encodeURIComponent(bossTemplateId)}/boss-battle-instances${qs ? `?${qs}` : ""}`
    );
}

/**
 * Update a boss battle instance
 * PATCH /boss-battle-instances/{boss_instance_id}
 */
export function updateBossBattleInstance(
    bossInstanceId: string,
    updates: UpdateBossBattleInstanceInput
) {
    return api<{
        message: string;
        boss_instance_id: string;
        updated_at: string;
    }>(`/boss-battle-instances/${encodeURIComponent(bossInstanceId)}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
    });
}

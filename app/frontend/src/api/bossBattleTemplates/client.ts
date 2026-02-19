/**
 * Boss battle templates API client
 */

import { api } from "../http.js";
import type {
    BossBattleTemplate,
    CreateBossBattleTemplateInput,
    PaginatedBossBattleTemplates,
} from "./types.js";

/**
 * Create a new boss battle template
 * POST /boss-battle-templates
 */
export function createBossBattleTemplate(data: CreateBossBattleTemplateInput) {
    return api<{ boss_template_id: string; message: string }>(
        "/boss-battle-templates",
        {
            method: "POST",
            body: JSON.stringify(data),
        }
    );
}

/**
 * Get a boss battle template by ID
 * GET /boss-battle-templates/{boss_template_id}
 */
export function getBossBattleTemplate(boss_template_id: string) {
    return api<BossBattleTemplate>(
        `/boss-battle-templates/${encodeURIComponent(boss_template_id)}`
    );
}

/**
 * List all boss battle templates owned by a teacher
 * GET /teachers/{teacher_id}/boss-battle-templates
 */
export function listBossBattleTemplatesByOwner(teacher_id: string) {
    return api<{ items: BossBattleTemplate[] }>(
        `/teachers/${encodeURIComponent(teacher_id)}/boss-battle-templates`
    );
}

/**
 * List public boss battle templates with optional filters
 * GET /boss-battle-templates/public?subject=&limit=&cursor=
 */
export function listPublicBossBattleTemplates(options?: {
    subject?: string;
    limit?: number;
    cursor?: string;
}) {
    const params = new URLSearchParams();

    if (options?.subject) {
        params.append("subject", options.subject);
    }

    if (options?.limit !== undefined) {
        params.append("limit", options.limit.toString());
    }

    if (options?.cursor) {
        params.append("cursor", options.cursor);
    }

    const queryString = params.toString();
    const url = `/boss-battle-templates/public${queryString ? `?${queryString}` : ""}`;

    return api<PaginatedBossBattleTemplates>(url);
}

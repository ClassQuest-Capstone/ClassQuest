/**
 * Boss questions API client
 */

import { api } from "../http.js";
import type {
    BossQuestion,
    CreateBossQuestionInput,
    UpdateBossQuestionInput,
    PaginatedBossQuestions,
} from "./types.js";

/**
 * Create a new question for a boss template
 * POST /boss-templates/{boss_template_id}/questions
 */
export function createBossQuestion(
    boss_template_id: string,
    data: CreateBossQuestionInput
) {
    return api<{ question_id: string; order_key: string; message: string }>(
        `/boss-templates/${encodeURIComponent(boss_template_id)}/questions`,
        {
            method: "POST",
            body: JSON.stringify(data),
        }
    );
}

/**
 * Get a boss question by ID
 * GET /boss-questions/{question_id}
 */
export function getBossQuestion(question_id: string) {
    return api<BossQuestion>(
        `/boss-questions/${encodeURIComponent(question_id)}`
    );
}

/**
 * List all questions for a boss template with pagination
 * GET /boss-templates/{boss_template_id}/questions?limit=&cursor=
 */
export function listBossQuestionsByTemplate(
    boss_template_id: string,
    options?: {
        limit?: number;
        cursor?: string;
    }
) {
    const params = new URLSearchParams();

    if (options?.limit !== undefined) {
        params.append("limit", options.limit.toString());
    }

    if (options?.cursor) {
        params.append("cursor", options.cursor);
    }

    const queryString = params.toString();
    const url = `/boss-templates/${encodeURIComponent(boss_template_id)}/questions${
        queryString ? `?${queryString}` : ""
    }`;

    return api<PaginatedBossQuestions>(url);
}

/**
 * Update a boss question
 * PATCH /boss-questions/{question_id}
 */
export function updateBossQuestion(
    question_id: string,
    data: UpdateBossQuestionInput
) {
    return api<{ question_id: string; message: string }>(
        `/boss-questions/${encodeURIComponent(question_id)}`,
        {
            method: "PATCH",
            body: JSON.stringify(data),
        }
    );
}

/**
 * Delete a boss question
 * DELETE /boss-questions/{question_id}
 */
export function deleteBossQuestion(question_id: string) {
    return api<void>(
        `/boss-questions/${encodeURIComponent(question_id)}`,
        {
            method: "DELETE",
        }
    );
}

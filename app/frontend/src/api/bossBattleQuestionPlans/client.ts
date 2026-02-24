import { api } from "../http.js";
import type { BossBattleQuestionPlan } from "./types.js";

/**
 * Get question plan by ID
 * GET /boss-battle-question-plans/{plan_id}
 */
export function getBossBattleQuestionPlan(planId: string) {
    return api<BossBattleQuestionPlan>(
        `/boss-battle-question-plans/${encodeURIComponent(planId)}`
    );
}

/**
 * Reward milestones API client
 *
 * Auth is attached automatically by the shared `api()` wrapper in http.ts
 * via AWS Amplify's fetchAuthSession (Bearer token on every request).
 */

import { api } from "../http.js";
import type {
    RewardMilestone,
    RewardMilestoneListResponse,
    StudentRewardMilestonesResponse,
    CreateRewardMilestoneRequest,
    UpdateRewardMilestoneRequest,
    SetRewardMilestoneStatusResponse,
    SoftDeleteRewardMilestoneResponse,
    RestoreRewardMilestoneResponse,
    StudentRewardMilestone,
} from "./types.js";

// ─── Teacher API ──────────────────────────────────────────────────────────────

/**
 * Create a new reward milestone for a class.
 * POST /teacher/rewards
 */
export function createRewardMilestone(
    payload: CreateRewardMilestoneRequest
): Promise<RewardMilestone> {
    return api<RewardMilestone>("/teacher/rewards", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * Get a single reward milestone by ID.
 * GET /teacher/rewards/{rewardId}
 */
export function getRewardMilestone(rewardId: string): Promise<RewardMilestone> {
    return api<RewardMilestone>(
        `/teacher/rewards/${encodeURIComponent(rewardId)}`
    );
}

/**
 * List all reward milestones for a class, sorted by unlock level.
 * GET /teacher/classes/{classId}/rewards
 *
 * Options:
 *   includeDeleted   — pass include_deleted=true to the backend (default: omitted)
 *   includeInactive  — NOTE: the backend returns active and inactive rewards by
 *                      default; set includeInactive=false to filter client-side.
 *                      A future backend parameter will be added for server-side filtering.
 */
export async function listRewardMilestonesByClass(
    classId: string,
    options?: {
        includeInactive?: boolean;
        includeDeleted?: boolean;
    }
): Promise<RewardMilestone[]> {
    const params = new URLSearchParams();

    if (options?.includeDeleted === true) {
        params.append("include_deleted", "true");
    }

    const query = params.toString();
    const url = `/teacher/classes/${encodeURIComponent(classId)}/rewards${query ? `?${query}` : ""}`;
    const { items } = await api<RewardMilestoneListResponse>(url);

    // Client-side active filter until the backend exposes an include_inactive param
    if (options?.includeInactive === false) {
        return items.filter(r => r.is_active);
    }
    return items;
}

/**
 * List all reward milestones created by a teacher, across all classes.
 * GET /teacher/rewards
 *
 * Options:
 *   teacherId        — required until auth is wired; the backend will use the
 *                      JWT claim instead once authentication is implemented.
 *   includeDeleted   — pass include_deleted=true to the backend (default: omitted)
 *   includeInactive  — see note on listRewardMilestonesByClass above
 *
 * TODO: remove teacherId option once auth is wired; server will read from JWT.
 */
export async function listRewardMilestonesByTeacher(options?: {
    teacherId?: string;
    includeInactive?: boolean;
    includeDeleted?: boolean;
}): Promise<RewardMilestone[]> {
    const params = new URLSearchParams();

    if (options?.teacherId) {
        params.append("teacher_id", options.teacherId);
    }
    if (options?.includeDeleted === true) {
        params.append("include_deleted", "true");
    }

    const query = params.toString();
    const url = `/teacher/rewards${query ? `?${query}` : ""}`;
    const { items } = await api<RewardMilestoneListResponse>(url);

    if (options?.includeInactive === false) {
        return items.filter(r => r.is_active);
    }
    return items;
}

/**
 * Update editable fields on a reward milestone.
 * Provide only the fields to change; sort keys are recomputed server-side.
 * PUT /teacher/rewards/{rewardId}
 */
export function updateRewardMilestone(
    rewardId: string,
    payload: UpdateRewardMilestoneRequest
): Promise<RewardMilestone> {
    return api<RewardMilestone>(
        `/teacher/rewards/${encodeURIComponent(rewardId)}`,
        {
            method: "PUT",
            body: JSON.stringify(payload),
        }
    );
}

/**
 * Activate or deactivate a reward milestone.
 * PATCH /teacher/rewards/{rewardId}/status
 */
export function setRewardMilestoneStatus(
    rewardId: string,
    isActive: boolean
): Promise<SetRewardMilestoneStatusResponse> {
    return api<SetRewardMilestoneStatusResponse>(
        `/teacher/rewards/${encodeURIComponent(rewardId)}/status`,
        {
            method: "PATCH",
            body: JSON.stringify({ is_active: isActive }),
        }
    );
}

/**
 * Soft-delete a reward milestone. The item is NOT removed from the database.
 * DELETE /teacher/rewards/{rewardId}
 */
export function softDeleteRewardMilestone(
    rewardId: string
): Promise<SoftDeleteRewardMilestoneResponse> {
    return api<SoftDeleteRewardMilestoneResponse>(
        `/teacher/rewards/${encodeURIComponent(rewardId)}`,
        { method: "DELETE" }
    );
}

/**
 * Restore a soft-deleted reward milestone.
 * PATCH /teacher/rewards/{rewardId}/restore
 */
export function restoreRewardMilestone(
    rewardId: string
): Promise<RestoreRewardMilestoneResponse> {
    return api<RestoreRewardMilestoneResponse>(
        `/teacher/rewards/${encodeURIComponent(rewardId)}/restore`,
        { method: "PATCH" }
    );
}

// ─── Student API ──────────────────────────────────────────────────────────────

/**
 * List active rewards for a class with lock/unlock status for a student.
 * GET /student/classes/{classId}/rewards
 *
 * Options:
 *   studentId — required until auth is wired; the backend will derive the
 *               student identity from the JWT claim once auth is implemented.
 *
 * TODO: remove studentId option once auth is wired; server will read from JWT.
 */
export async function listStudentRewardMilestones(
    classId: string,
    options?: { studentId?: string }
): Promise<StudentRewardMilestonesResponse> {
    const params = new URLSearchParams();

    if (options?.studentId) {
        params.append("student_id", options.studentId);
    }

    const query = params.toString();
    const url = `/student/classes/${encodeURIComponent(classId)}/rewards${query ? `?${query}` : ""}`;

    const raw = await api<{ items: StudentRewardMilestone[]; student_level: number }>(url);

    // Normalize: rename `items` → `rewards` and inject `class_id` for consumers
    return {
        class_id: classId,
        student_level: raw.student_level,
        rewards: raw.items,
    };
}

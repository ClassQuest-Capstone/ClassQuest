/**
 * Student reward claims API client
 *
 * Auth is attached automatically by the shared `api()` wrapper in http.ts
 * via AWS Amplify's fetchAuthSession (Bearer token on every request).
 */

import { api } from "../http.js";
import type {
    StudentRewardClaim,
    StudentRewardClaimListResponse,
    CreateStudentRewardClaimRequest,
    ClaimStudentRewardRequest,
    ClaimStudentRewardResponse,
    CreateAvailableClaimsForLevelUpRequest,
    CreateAvailableClaimsForLevelUpResponse,
    StudentRewardsStateResponse,
} from "./types.js";

// ─── Internal API ──────────────────────────────────────────────────────────────

/**
 * Create a claim row manually (internal/testing).
 * POST /internal/student-reward-claims
 */
export function createStudentRewardClaim(
    payload: CreateStudentRewardClaimRequest
): Promise<StudentRewardClaim> {
    return api<StudentRewardClaim>("/internal/student-reward-claims", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * Get one claim row by ID.
 * GET /internal/student-reward-claims/{claimId}
 */
export function getStudentRewardClaim(claimId: string): Promise<StudentRewardClaim> {
    return api<StudentRewardClaim>(
        `/internal/student-reward-claims/${encodeURIComponent(claimId)}`
    );
}

/**
 * List all claims for a student (internal/admin view).
 * GET /internal/students/{studentId}/reward-claims
 *
 * Options:
 *   classId — filter to a specific class
 *   status  — filter by AVAILABLE or CLAIMED
 */
export async function listStudentRewardClaimsInternal(
    studentId: string,
    options?: { classId?: string; status?: "AVAILABLE" | "CLAIMED" }
): Promise<StudentRewardClaim[]> {
    const params = new URLSearchParams();
    if (options?.classId) params.append("class_id", options.classId);
    if (options?.status)  params.append("status", options.status);

    const query = params.toString();
    const url = `/internal/students/${encodeURIComponent(studentId)}/reward-claims${query ? `?${query}` : ""}`;
    const { items } = await api<StudentRewardClaimListResponse>(url);
    return items;
}

/**
 * Create AVAILABLE claim rows for all newly crossed milestones after a level increase.
 * POST /internal/students/{studentId}/reward-claims/level-up-sync
 */
export function createAvailableClaimsForLevelUp(
    studentId: string,
    payload: CreateAvailableClaimsForLevelUpRequest
): Promise<CreateAvailableClaimsForLevelUpResponse> {
    return api<CreateAvailableClaimsForLevelUpResponse>(
        `/internal/students/${encodeURIComponent(studentId)}/reward-claims/level-up-sync`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        }
    );
}

// ─── Student API ───────────────────────────────────────────────────────────────

/**
 * List reward claims for the authenticated student in a class.
 * GET /student/classes/{classId}/reward-claims
 *
 * Options:
 *   status — filter by AVAILABLE or CLAIMED
 *
 * TODO: student_id is passed as a query param until auth is wired.
 */
export async function listStudentRewardClaimsByStudent(
    classId: string,
    studentId: string,
    status?: "AVAILABLE" | "CLAIMED"
): Promise<StudentRewardClaim[]> {
    const params = new URLSearchParams();
    params.append("student_id", studentId);
    if (status) params.append("status", status);

    const url = `/student/classes/${encodeURIComponent(classId)}/reward-claims?${params.toString()}`;
    const { items } = await api<StudentRewardClaimListResponse>(url);
    return items;
}

/**
 * Claim an AVAILABLE reward (AVAILABLE → CLAIMED).
 * POST /student/rewards/{rewardId}/claim
 */
export function claimStudentReward(
    rewardId: string,
    payload: ClaimStudentRewardRequest
): Promise<ClaimStudentRewardResponse> {
    return api<ClaimStudentRewardResponse>(
        `/student/rewards/${encodeURIComponent(rewardId)}/claim`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        }
    );
}

/**
 * Get merged LOCKED / AVAILABLE / CLAIMED state for all rewards in a class.
 * GET /student/classes/{classId}/rewards-state
 *
 * TODO: student_id is passed as a query param until auth is wired.
 */
export function getStudentRewardsStateForClass(
    classId: string,
    studentId: string
): Promise<StudentRewardsStateResponse> {
    return api<StudentRewardsStateResponse>(
        `/student/classes/${encodeURIComponent(classId)}/rewards-state?student_id=${encodeURIComponent(studentId)}`
    );
}

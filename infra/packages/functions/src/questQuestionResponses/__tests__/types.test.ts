/**
 * Unit tests for questQuestionResponses/types.ts
 * Covers deriveResponseStatus, deriveRewardStatus, normalizeResponseItem
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questQuestionResponses
 */
import { describe, it, expect } from "vitest";
import {
    deriveResponseStatus,
    deriveRewardStatus,
    normalizeResponseItem,
    ResponseStatus,
    RewardStatus,
} from "../types.js";

// ---------------------------------------------------------------------------
// deriveResponseStatus
// ---------------------------------------------------------------------------
describe("deriveResponseStatus", () => {
    it("returns NOT_STARTED when answer_raw is missing", () => {
        expect(deriveResponseStatus({})).toBe(ResponseStatus.NOT_STARTED);
    });

    it("returns NOT_STARTED when answer_raw is empty object", () => {
        expect(deriveResponseStatus({ answer_raw: {} })).toBe(ResponseStatus.NOT_STARTED);
    });

    it("returns GRADED when teacher_points_awarded is present (even 0)", () => {
        expect(deriveResponseStatus({
            answer_raw: { text: "ans" },
            teacher_points_awarded: 0,
        })).toBe(ResponseStatus.GRADED);
    });

    it("returns CORRECT when submitted + auto_graded + auto_points > 0", () => {
        expect(deriveResponseStatus({
            answer_raw: { text: "ans" },
            submitted_at: "2024-01-01T00:00:00.000Z",
            is_auto_graded: true,
            auto_points_awarded: 5,
        })).toBe(ResponseStatus.CORRECT);
    });

    it("returns INCORRECT when submitted + auto_graded + auto_points === 0", () => {
        expect(deriveResponseStatus({
            answer_raw: { text: "ans" },
            submitted_at: "2024-01-01T00:00:00.000Z",
            is_auto_graded: true,
            auto_points_awarded: 0,
        })).toBe(ResponseStatus.INCORRECT);
    });

    it("returns NEEDS_REVIEW when submitted + not auto_graded", () => {
        expect(deriveResponseStatus({
            answer_raw: { text: "ans" },
            submitted_at: "2024-01-01T00:00:00.000Z",
            is_auto_graded: false,
        })).toBe(ResponseStatus.NEEDS_REVIEW);
    });

    it("returns IN_PROGRESS when answer_raw present but no submitted_at", () => {
        expect(deriveResponseStatus({
            answer_raw: { text: "draft" },
        })).toBe(ResponseStatus.IN_PROGRESS);
    });

    it("GRADED takes priority over auto-graded check", () => {
        // teacher_points_awarded check comes before auto-graded check
        expect(deriveResponseStatus({
            answer_raw: { text: "ans" },
            teacher_points_awarded: 10,
            submitted_at: "2024-01-01T00:00:00.000Z",
            is_auto_graded: true,
            auto_points_awarded: 5,
        })).toBe(ResponseStatus.GRADED);
    });
});

// ---------------------------------------------------------------------------
// deriveRewardStatus
// ---------------------------------------------------------------------------
describe("deriveRewardStatus", () => {
    it("returns APPLIED when reward_txn_id is present", () => {
        expect(deriveRewardStatus({ reward_txn_id: "txn-abc" })).toBe(RewardStatus.APPLIED);
    });

    it("returns PENDING when xp_awarded_total > 0", () => {
        expect(deriveRewardStatus({ xp_awarded_total: 10 })).toBe(RewardStatus.PENDING);
    });

    it("returns PENDING when gold_awarded_total > 0", () => {
        expect(deriveRewardStatus({ gold_awarded_total: 5 })).toBe(RewardStatus.PENDING);
    });

    it("returns undefined when no rewards and no txn_id", () => {
        expect(deriveRewardStatus({})).toBeUndefined();
    });

    it("returns undefined when xp and gold are 0", () => {
        expect(deriveRewardStatus({ xp_awarded_total: 0, gold_awarded_total: 0 })).toBeUndefined();
    });

    it("APPLIED takes priority (reward_txn_id present + xp > 0)", () => {
        expect(deriveRewardStatus({ reward_txn_id: "txn-abc", xp_awarded_total: 10 }))
            .toBe(RewardStatus.APPLIED);
    });
});

// ---------------------------------------------------------------------------
// normalizeResponseItem
// ---------------------------------------------------------------------------
describe("normalizeResponseItem", () => {
    it("applies default attempt_count = 0", () => {
        const item = normalizeResponseItem({ answer_raw: { t: "a" } });
        expect(item.attempt_count).toBe(0);
    });

    it("preserves explicit attempt_count", () => {
        const item = normalizeResponseItem({ answer_raw: { t: "a" }, attempt_count: 3 });
        expect(item.attempt_count).toBe(3);
    });

    it("applies default wrong_attempt_count = 0", () => {
        const item = normalizeResponseItem({ answer_raw: { t: "a" } });
        expect(item.wrong_attempt_count).toBe(0);
    });

    it("applies default xp_awarded_total = 0", () => {
        const item = normalizeResponseItem({ answer_raw: { t: "a" } });
        expect(item.xp_awarded_total).toBe(0);
    });

    it("applies default gold_awarded_total = 0", () => {
        const item = normalizeResponseItem({ answer_raw: { t: "a" } });
        expect(item.gold_awarded_total).toBe(0);
    });

    it("derives status when not set", () => {
        const item = normalizeResponseItem({});
        expect(item.status).toBe(ResponseStatus.NOT_STARTED);
    });

    it("preserves explicit status", () => {
        const item = normalizeResponseItem({ status: ResponseStatus.CORRECT });
        expect(item.status).toBe(ResponseStatus.CORRECT);
    });

    it("derives reward_status when not set", () => {
        const item = normalizeResponseItem({ reward_txn_id: "txn-abc" });
        expect(item.reward_status).toBe(RewardStatus.APPLIED);
    });

    it("preserves explicit reward_status", () => {
        const item = normalizeResponseItem({ reward_status: RewardStatus.REVERSED });
        expect(item.reward_status).toBe(RewardStatus.REVERSED);
    });

    it("spreads all original fields", () => {
        const item = normalizeResponseItem({
            quest_instance_id: "qi-1",
            student_id: "s-1",
            question_id: "q-1",
        });
        expect(item.quest_instance_id).toBe("qi-1");
        expect(item.student_id).toBe("s-1");
        expect(item.question_id).toBe("q-1");
    });
});

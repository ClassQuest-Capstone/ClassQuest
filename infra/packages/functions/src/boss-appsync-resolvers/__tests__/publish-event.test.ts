/**
 * Unit tests for publish-event.ts — SigV4-signed AppSync HTTP helper.
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @smithy/signature-v4 and @aws-crypto/sha256-js before any import.
// The signer instance is created at module-load time, so the mock must be
// in place before the module is first imported.
// ---------------------------------------------------------------------------
const mockSign = vi.fn();

vi.mock("@smithy/signature-v4", () => ({
    SignatureV4: vi.fn(function () {
        return { sign: mockSign };
    }),
}));

vi.mock("@aws-crypto/sha256-js", () => ({
    Sha256: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module references — imported after mocks + env vars are set.
// ---------------------------------------------------------------------------
let publishBattleStateChanged: (typeof import("../publish-event.ts"))["publishBattleStateChanged"];
let publishAnswerSubmitted:    (typeof import("../publish-event.ts"))["publishAnswerSubmitted"];
let publishRosterChanged:      (typeof import("../publish-event.ts"))["publishRosterChanged"];

// Stub global fetch before the module loads (fetch is called in function bodies,
// not at module init, so stubbing in beforeAll is safe).
const mockFetch = vi.fn();

beforeAll(async () => {
    process.env.APPSYNC_API_URL        = "https://test123.appsync-api.ca-central-1.amazonaws.com/graphql";
    process.env.AWS_REGION             = "ca-central-1";
    process.env.AWS_ACCESS_KEY_ID      = "AKIATEST";
    process.env.AWS_SECRET_ACCESS_KEY  = "test-secret";
    process.env.AWS_SESSION_TOKEN      = "test-token";

    vi.stubGlobal("fetch", mockFetch);

    const mod = await import("../publish-event.ts");
    publishBattleStateChanged = mod.publishBattleStateChanged;
    publishAnswerSubmitted    = mod.publishAnswerSubmitted;
    publishRosterChanged      = mod.publishRosterChanged;
});

beforeEach(() => {
    mockSign.mockReset();
    mockFetch.mockReset();

    // Default: signer returns signed headers
    mockSign.mockResolvedValue({
        headers: {
            "Content-Type":  "application/json",
            "Authorization": "AWS4-HMAC-SHA256 Credential=AKIATEST/...",
            host:            "test123.appsync-api.ca-central-1.amazonaws.com",
        },
    });

    // Default: fetch returns a successful AppSync response
    mockFetch.mockResolvedValue({
        ok:   true,
        json: async () => ({ data: { publishBattleStateChanged: { boss_instance_id: "inst-1" } } }),
        text: async () => "",
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeStatePayload(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id: "inst-1",
        status:           "LOBBY",
        current_boss_hp:  1000,
        initial_boss_hp:  1000,
        updated_at:       "2026-04-09T10:00:00.000Z",
        ...overrides,
    };
}

function makeParticipant(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id: "inst-1",
        student_id:       "student-1",
        class_id:         "class-1",
        guild_id:         "guild-1",
        state:            "ACTIVE",
        joined_at:        "2026-04-09T10:00:00.000Z",
        updated_at:       "2026-04-09T10:00:00.000Z",
        is_downed:        false,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// publishBattleStateChanged
// ---------------------------------------------------------------------------
describe("publishBattleStateChanged", () => {
    it("calls fetch once with the AppSync URL", async () => {
        await publishBattleStateChanged(makeStatePayload());

        expect(mockFetch).toHaveBeenCalledOnce();
        const [url] = mockFetch.mock.calls[0];
        expect(url).toBe(process.env.APPSYNC_API_URL);
    });

    it("sends a POST request with JSON body containing query and variables", async () => {
        const payload = makeStatePayload({ status: "QUESTION_ACTIVE" });
        await publishBattleStateChanged(payload);

        const [, init] = mockFetch.mock.calls[0];
        expect(init.method).toBe("POST");

        const body = JSON.parse(init.body);
        expect(body).toHaveProperty("query");
        expect(body.query).toContain("publishBattleStateChanged");
        expect(body.variables.input.boss_instance_id).toBe("inst-1");
        expect(body.variables.input.status).toBe("QUESTION_ACTIVE");
    });

    it("calls signer.sign before calling fetch", async () => {
        await publishBattleStateChanged(makeStatePayload());

        expect(mockSign).toHaveBeenCalledOnce();
        expect(mockFetch).toHaveBeenCalledOnce();
        // sign is called first (call index 0 happens before fetch call index 0)
        expect(mockSign.mock.invocationCallOrder[0])
            .toBeLessThan(mockFetch.mock.invocationCallOrder[0]);
    });

    it("does NOT throw when fetch returns a non-OK HTTP status", async () => {
        mockFetch.mockResolvedValue({
            ok:   false,
            status: 403,
            text: async () => "Forbidden",
        });

        // Must resolve (not reject) — publish failures are non-fatal
        await expect(publishBattleStateChanged(makeStatePayload())).resolves.toBeUndefined();
    });

    it("does NOT throw when the AppSync response contains GraphQL errors", async () => {
        mockFetch.mockResolvedValue({
            ok:   true,
            json: async () => ({ errors: [{ message: "Unauthorized" }] }),
            text: async () => "",
        });

        await expect(publishBattleStateChanged(makeStatePayload())).resolves.toBeUndefined();
    });

    it("does NOT throw when signer.sign rejects", async () => {
        mockSign.mockRejectedValue(new Error("signing failed"));

        await expect(publishBattleStateChanged(makeStatePayload())).resolves.toBeUndefined();
    });

    it("does NOT throw when fetch itself rejects (network error)", async () => {
        mockFetch.mockRejectedValue(new Error("Network error"));

        await expect(publishBattleStateChanged(makeStatePayload())).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// publishAnswerSubmitted
// ---------------------------------------------------------------------------
describe("publishAnswerSubmitted", () => {
    it("sends correct variables to AppSync", async () => {
        mockFetch.mockResolvedValue({
            ok: true, json: async () => ({ data: {} }), text: async () => "",
        });

        await publishAnswerSubmitted({
            boss_instance_id:      "inst-1",
            student_id:            "student-42",
            is_correct:            true,
            received_answer_count: 5,
            required_answer_count: 10,
            ready_to_resolve:      false,
            updated_at:            "2026-04-09T10:05:00.000Z",
        });

        expect(mockFetch).toHaveBeenCalledOnce();
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.query).toContain("publishAnswerSubmitted");
        expect(body.variables.bossInstanceId).toBe("inst-1");
        expect(body.variables.studentId).toBe("student-42");
        expect(body.variables.isCorrect).toBe(true);
        expect(body.variables.receivedAnswerCount).toBe(5);
        expect(body.variables.requiredAnswerCount).toBe(10);
        expect(body.variables.readyToResolve).toBe(false);
    });

    it("maps null optional fields to null in variables", async () => {
        mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: {} }), text: async () => "" });

        await publishAnswerSubmitted({
            boss_instance_id: "inst-1",
            student_id:       "s-1",
            is_correct:       false,
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.variables.receivedAnswerCount).toBeNull();
        expect(body.variables.requiredAnswerCount).toBeNull();
        expect(body.variables.readyToResolve).toBeNull();
    });

    it("does NOT throw on fetch failure", async () => {
        mockFetch.mockRejectedValue(new Error("timeout"));
        await expect(publishAnswerSubmitted({
            boss_instance_id: "inst-1",
            student_id: "s-1",
            is_correct: true,
        })).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// publishRosterChanged
// ---------------------------------------------------------------------------
describe("publishRosterChanged", () => {
    it("sends bossInstanceId and participants array to AppSync", async () => {
        mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: {} }), text: async () => "" });

        const participants = [makeParticipant(), makeParticipant({ student_id: "student-2" })];
        await publishRosterChanged("inst-1", participants);

        expect(mockFetch).toHaveBeenCalledOnce();
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.query).toContain("publishRosterChanged");
        expect(body.variables.bossInstanceId).toBe("inst-1");
        expect(body.variables.participants).toHaveLength(2);
        expect(body.variables.participants[0].student_id).toBe("student-1");
    });

    it("does NOT throw on fetch failure", async () => {
        mockFetch.mockRejectedValue(new Error("connection refused"));
        await expect(publishRosterChanged("inst-1", [])).resolves.toBeUndefined();
    });

    it("sends empty participants array when roster is empty", async () => {
        mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: {} }), text: async () => "" });

        await publishRosterChanged("inst-1", []);

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.variables.participants).toEqual([]);
    });
});

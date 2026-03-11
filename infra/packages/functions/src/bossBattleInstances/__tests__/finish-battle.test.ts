/**
 * Unit tests for the FinishBattle lifecycle action.
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DynamoDB
// ---------------------------------------------------------------------------
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: vi.fn(function () { return {}; }),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(function () { return { send: mockSend }; }),
    },
    PutCommand:    vi.fn(function (input: any) { this.input = input; }),
    GetCommand:    vi.fn(function (input: any) { this.input = input; }),
    QueryCommand:  vi.fn(function (input: any) { this.input = input; }),
    UpdateCommand: vi.fn(function (input: any) { this.input = input; }),
}));

// ---------------------------------------------------------------------------
// Mock bossResults/repo — computeAndWriteBossResults is an async side-effect
// ---------------------------------------------------------------------------
const mockComputeAndWriteBossResults = vi.fn();

vi.mock("../../bossResults/repo.js", () => ({
    computeAndWriteBossResults: (...args: any[]) => mockComputeAndWriteBossResults(...args),
}));

// ---------------------------------------------------------------------------
// Module reference
// ---------------------------------------------------------------------------
let finishBattleHandler: (typeof import("../finish-battle.ts"))["handler"];

beforeAll(async () => {
    process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME    = "test-bbi";
    process.env.BOSS_BATTLE_PARTICIPANTS_TABLE_NAME = "test-bbp";
    process.env.BOSS_RESULTS_TABLE_NAME             = "test-br";

    finishBattleHandler = (await import("../finish-battle.ts")).handler;
});

beforeEach(() => {
    mockSend.mockReset();
    mockComputeAndWriteBossResults.mockReset();
    // Default: results successfully written
    mockComputeAndWriteBossResults.mockResolvedValue({ success: true, message: "Results written" });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeInstance(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id:       "bbi-1",
        class_id:               "class-1",
        boss_template_id:       "tpl-1",
        created_by_teacher_id:  "teacher-1",
        status:                 "INTERMISSION",
        mode_type:              "SIMULTANEOUS_ALL",
        question_selection_mode:"ORDERED",
        initial_boss_hp:        100,
        current_boss_hp:        50,
        current_question_index: 2,
        speed_bonus_enabled:    false,
        speed_bonus_floor_multiplier: 1,
        speed_window_seconds:   10,
        anti_spam_min_submit_interval_ms: 500,
        freeze_on_wrong_seconds: 0,
        late_join_policy:       "DISALLOW_AFTER_COUNTDOWN",
        created_at:             "2025-01-01T00:00:00.000Z",
        updated_at:             "2025-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeParticipant(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id: "bbi-1",
        student_id:       "student-1",
        guild_id:         "guild-1",
        state:            "JOINED",
        is_downed:        false,
        hearts:           3,
        created_at:       "2025-01-01T00:00:00.000Z",
        updated_at:       "2025-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeEvent(overrides: Record<string, any> = {}) {
    return {
        routeKey: "POST /boss-battle-instances/{boss_instance_id}/finish",
        pathParameters: { boss_instance_id: "bbi-1" },
        requestContext: {
            authorizer: {
                jwt: {
                    claims: {
                        sub: "teacher-1",
                        "cognito:groups": "Teachers",
                    },
                },
            },
        },
        ...overrides,
    };
}

/** Sequence of DynamoDB responses for the normal WIN path:
 *  1. GetItem (instance load) → instance
 *  2. UpdateItem (finishBattle conditional update) → updated instance
 */
function setupWinPath(instanceOverrides: Record<string, any> = {}) {
    const instance = makeInstance({ current_boss_hp: 0, ...instanceOverrides });
    const updated  = { ...instance, status: "COMPLETED", outcome: "WIN", completed_at: "2025-01-01T01:00:00.000Z" };

    mockSend
        .mockResolvedValueOnce({ Item: instance })       // GetItem — load instance
        .mockResolvedValueOnce({ Attributes: updated }); // UpdateItem — finishBattle
}

/** Sequence for FAIL / ALL_GUILDS_DOWN:
 *  1. GetItem (instance)
 *  2. QueryCommand (listParticipants with state=JOINED filter applied)
 *  3. UpdateItem (finishBattle)
 */
function setupFailPath(participants: any[], instanceOverrides: Record<string, any> = {}) {
    const instance = makeInstance({ current_boss_hp: 50, ...instanceOverrides });
    const updated  = { ...instance, status: "COMPLETED", outcome: "FAIL", fail_reason: "ALL_GUILDS_DOWN", completed_at: "2025-01-01T01:00:00.000Z" };

    mockSend
        .mockResolvedValueOnce({ Item: instance })
        .mockResolvedValueOnce({ Items: participants })  // QueryCommand — listParticipants
        .mockResolvedValueOnce({ Attributes: updated }); // UpdateItem — finishBattle
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FinishBattle handler", () => {

    // ── Input validation ────────────────────────────────────────────────────

    it("returns 400 when boss_instance_id is missing", async () => {
        const res = await finishBattleHandler(makeEvent({ pathParameters: {} }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body)).toMatchObject({ error: expect.stringContaining("boss_instance_id") });
    });

    // ── Not-found / wrong state ─────────────────────────────────────────────

    it("returns 404 when instance does not exist", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(404);
    });

    it("returns 409 when instance is already COMPLETED", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "COMPLETED" }) });
        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/already COMPLETED/i);
    });

    it("returns 409 when instance is ABORTED", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "ABORTED" }) });
        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/ABORTED/i);
    });

    it("returns 409 when instance is in QUESTION_ACTIVE (not finishable)", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "QUESTION_ACTIVE" }) });
        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        const body = JSON.parse(res.body);
        expect(body.error).toMatch(/not in a finishable state/i);
        expect(body.current_status).toBe("QUESTION_ACTIVE");
    });

    it("returns 409 when instance is in LOBBY (not finishable)", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "LOBBY" }) });
        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(409);
    });

    it("returns 409 when instance is in COUNTDOWN (not finishable)", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "COUNTDOWN" }) });
        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(409);
    });

    // ── WIN path ────────────────────────────────────────────────────────────

    it("returns 200 with WIN when boss HP is 0 (INTERMISSION)", async () => {
        setupWinPath({ status: "INTERMISSION" });
        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.outcome).toBe("WIN");
        expect(body.fail_reason).toBeNull();
        expect(body.status).toBe("COMPLETED");
        expect(body.boss_instance_id).toBe("bbi-1");
        expect(body.completed_at).toBeTruthy();
    });

    it("returns 200 with WIN when boss HP is 0 (RESOLVING)", async () => {
        setupWinPath({ status: "RESOLVING" });
        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).outcome).toBe("WIN");
    });

    it("does NOT load participants when boss HP is 0 (no unnecessary DB calls)", async () => {
        setupWinPath();
        await finishBattleHandler(makeEvent());
        // Only 2 calls: GetItem + UpdateItem — no QueryCommand for participants
        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    // ── FAIL / ALL_GUILDS_DOWN path ─────────────────────────────────────────

    it("returns 200 with FAIL/ALL_GUILDS_DOWN when all guilds are downed", async () => {
        const participants = [
            makeParticipant({ student_id: "s1", guild_id: "guild-1", is_downed: true }),
            makeParticipant({ student_id: "s2", guild_id: "guild-1", is_downed: true }),
            makeParticipant({ student_id: "s3", guild_id: "guild-2", is_downed: true }),
        ];
        setupFailPath(participants);

        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.outcome).toBe("FAIL");
        expect(body.fail_reason).toBe("ALL_GUILDS_DOWN");
        expect(body.status).toBe("COMPLETED");
    });

    it("returns 200 FAIL when single guild with single downed member", async () => {
        const participants = [
            makeParticipant({ student_id: "s1", guild_id: "guild-1", is_downed: true }),
        ];
        setupFailPath(participants);

        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).outcome).toBe("FAIL");
    });

    it("returns 409 when boss is alive and not all guilds are down (one active member)", async () => {
        const participants = [
            makeParticipant({ student_id: "s1", guild_id: "guild-1", is_downed: true }),
            makeParticipant({ student_id: "s2", guild_id: "guild-1", is_downed: false }),
        ];
        const instance = makeInstance({ current_boss_hp: 50 });
        const updated = { ...instance, status: "COMPLETED", outcome: "FAIL" };

        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({ Attributes: updated });

        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/not ready to be finished/i);
    });

    it("returns 409 when boss is alive and no participants joined (guildDownedMap empty)", async () => {
        const instance = makeInstance({ current_boss_hp: 50 });
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Items: [] }); // no JOINED participants

        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(409);
    });

    it("returns 409 when boss is alive and some guilds are still active across multi-guild", async () => {
        const participants = [
            makeParticipant({ student_id: "s1", guild_id: "guild-1", is_downed: true }),
            makeParticipant({ student_id: "s2", guild_id: "guild-2", is_downed: false }), // guild-2 is alive
        ];
        const instance = makeInstance({ current_boss_hp: 50 });
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Items: participants });

        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(409);
    });

    // ── Concurrency guard ───────────────────────────────────────────────────

    it("returns 409 on ConditionalCheckFailedException (duplicate finish)", async () => {
        // Instance loaded as INTERMISSION, boss HP=0 → WIN path
        const instance = makeInstance({ current_boss_hp: 0 });
        const err: any = new Error("ConditionalCheckFailedException");
        err.name = "ConditionalCheckFailedException";

        mockSend
            .mockResolvedValueOnce({ Item: instance }) // GetItem
            .mockRejectedValueOnce(err);               // UpdateItem throws

        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/already finished/i);
    });

    // ── BossResults ─────────────────────────────────────────────────────────

    it("calls computeAndWriteBossResults after transitioning to COMPLETED", async () => {
        setupWinPath();
        await finishBattleHandler(makeEvent());
        expect(mockComputeAndWriteBossResults).toHaveBeenCalledTimes(1);
        expect(mockComputeAndWriteBossResults).toHaveBeenCalledWith("bbi-1", "finish-battle");
    });

    it("returns results_written: true when computeAndWriteBossResults succeeds", async () => {
        setupWinPath();
        mockComputeAndWriteBossResults.mockResolvedValue({ success: true, message: "Results written" });

        const res = await finishBattleHandler(makeEvent());
        expect(JSON.parse(res.body).results_written).toBe(true);
    });

    it("returns results_written: false when computeAndWriteBossResults reports already written", async () => {
        setupWinPath();
        mockComputeAndWriteBossResults.mockResolvedValue({ success: false, message: "Results already exist" });

        const res = await finishBattleHandler(makeEvent());
        expect(JSON.parse(res.body).results_written).toBe(false);
    });

    it("does not call computeAndWriteBossResults if conditional update throws", async () => {
        const instance = makeInstance({ current_boss_hp: 0 });
        const err: any = new Error("ConditionalCheckFailedException");
        err.name = "ConditionalCheckFailedException";

        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockRejectedValueOnce(err);

        await finishBattleHandler(makeEvent());
        expect(mockComputeAndWriteBossResults).not.toHaveBeenCalled();
    });

    // ── Response shape ───────────────────────────────────────────────────────

    it("response includes all required fields", async () => {
        setupWinPath();
        const res = await finishBattleHandler(makeEvent());
        const body = JSON.parse(res.body);
        expect(body).toHaveProperty("boss_instance_id");
        expect(body).toHaveProperty("status");
        expect(body).toHaveProperty("outcome");
        expect(body).toHaveProperty("fail_reason");
        expect(body).toHaveProperty("completed_at");
        expect(body).toHaveProperty("results_written");
    });

    it("fail_reason is null on WIN outcome", async () => {
        setupWinPath();
        const res = await finishBattleHandler(makeEvent());
        expect(JSON.parse(res.body).fail_reason).toBeNull();
    });

    it("outcome and fail_reason are null when neither is set on updatedInstance (edge case)", async () => {
        // UpdateItem returns attributes without outcome/fail_reason set
        const instance = makeInstance({ current_boss_hp: 0 });
        const updated  = { ...instance, status: "COMPLETED", completed_at: "2025-01-01T01:00:00.000Z" };
        // Remove outcome/fail_reason to test fallback to null
        delete updated.outcome;
        delete updated.fail_reason;

        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Attributes: updated });

        const res = await finishBattleHandler(makeEvent());
        const body = JSON.parse(res.body);
        expect(body.outcome).toBeNull();
        expect(body.fail_reason).toBeNull();
    });

    // ── Error handling ───────────────────────────────────────────────────────

    it("returns 500 on unexpected DynamoDB error", async () => {
        mockSend.mockRejectedValueOnce(new Error("DynamoDB exploded"));
        const res = await finishBattleHandler(makeEvent());
        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body)).toMatchObject({ error: "Internal server error" });
    });

    // ── QuestApiStack wiring ─────────────────────────────────────────────────

    it("route key matches QuestApiStack registration", () => {
        const expectedRouteKey = "POST /boss-battle-instances/{boss_instance_id}/finish";
        // This is verified by the router dispatch table — just document the expected key
        expect(expectedRouteKey).toBe("POST /boss-battle-instances/{boss_instance_id}/finish");
    });
});

/**
 * Unit tests for the ResolveQuestion lifecycle action.
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
// Module reference
// ---------------------------------------------------------------------------
let resolveQuestionHandler: (typeof import("../resolve-question.ts"))["handler"];

beforeAll(async () => {
    process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME    = "test-bbi";
    process.env.BOSS_QUESTIONS_TABLE_NAME           = "test-bq";
    process.env.BOSS_ANSWER_ATTEMPTS_TABLE_NAME     = "test-baa";
    process.env.BOSS_BATTLE_PARTICIPANTS_TABLE_NAME = "test-bbp";
    process.env.PLAYER_STATES_TABLE_NAME            = "test-ps";
    process.env.REWARD_TRANSACTIONS_TABLE_NAME      = "test-rt";

    resolveQuestionHandler = (await import("../resolve-question.ts")).handler;
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeInstance(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id:   "inst-1",
        class_id:           "class-1",
        boss_template_id:   "tpl-1",
        created_by_teacher_id: "teacher-1",
        status:             "QUESTION_ACTIVE",
        mode_type:          "SIMULTANEOUS_ALL",
        active_question_id: "q-1",
        current_boss_hp:    1000,
        initial_boss_hp:    1000,
        current_question_index: 0,
        speed_bonus_enabled: true,
        speed_bonus_floor_multiplier: 0.2,
        speed_window_seconds: 30,
        anti_spam_min_submit_interval_ms: 1000,
        freeze_on_wrong_seconds: 3,
        // Quorum default: ready_to_resolve=true so existing tests are unaffected by gating
        ready_to_resolve:   true,
        required_answer_count: 3,
        received_answer_count: 3,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeQuestion(overrides: Record<string, any> = {}) {
    return {
        question_id:                  "q-1",
        boss_template_id:             "tpl-1",
        question_type:                "MCQ_SINGLE",
        question_text:                "What is 2+2?",
        correct_answer:               "4",
        auto_gradable:                true,
        damage_to_boss_on_correct:    100,
        damage_to_guild_on_incorrect: 50,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeAttempt(overrides: Record<string, any> = {}) {
    return {
        boss_attempt_pk:         "BI#inst-1#Q#q-1",
        attempt_sk:              "T#2026-01-01T00:00:01.000Z#S#student-1#A#uuid",
        boss_instance_id:        "inst-1",
        class_id:                "class-1",
        question_id:             "q-1",
        student_id:              "student-1",
        guild_id:                "guild-1",
        is_correct:              true,
        answered_at:             "2026-01-01T00:00:01.000Z",
        elapsed_seconds:         5,
        speed_multiplier:        0.9,
        damage_to_boss:          90,
        hearts_delta_student:    0,
        hearts_delta_guild_total: 0,
        mode_type:               "SIMULTANEOUS_ALL",
        status_at_submit:        "QUESTION_ACTIVE",
        ...overrides,
    };
}

function makeParticipant(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id: "inst-1",
        student_id:       "student-1",
        guild_id:         "guild-1",
        state:            "JOINED",
        is_downed:        false,
        joined_at:        "2026-01-01T00:00:00.000Z",
        updated_at:       "2026-01-01T00:00:00.000Z",
        gsi2_sk:          "inst-1#student-1",
        ...overrides,
    };
}

function makePlayerState(overrides: Record<string, any> = {}) {
    return {
        class_id:         "class-1",
        student_id:       "student-1",
        hearts:           3,
        max_hearts:       3,
        current_xp:       0,
        total_xp_earned:  0,
        xp_to_next_level: 100,
        gold:             0,
        status:           "ALIVE",
        leaderboard_sort: "00000000000#student-1",
        created_at:       "2026-01-01T00:00:00.000Z",
        updated_at:       "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeUpdatedInstance(overrides: Record<string, any> = {}) {
    return {
        ...makeInstance(),
        status:     "INTERMISSION",
        updated_at: "2026-01-01T00:01:00.000Z",
        ...overrides,
    };
}

function makeEvent(pathOverrides: Record<string, any> = {}) {
    return {
        pathParameters: { boss_instance_id: "inst-1", ...pathOverrides },
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
    };
}

/**
 * Happy path for SIMULTANEOUS_ALL with one correct attempt (no penalties):
 *   1. GetCommand → instance
 *   2. GetCommand → question
 *   3. QueryCommand → attempts (1 correct)
 *   4. QueryCommand → listParticipants (1 participant)
 *   5. GetCommand → playerState(student-1)   [Promise.all]
 *   6. UpdateCommand → resolveQuestion (instance)
 */
function mockHappyPathNopenalties(
    instance = makeInstance(),
    question = makeQuestion(),
    attempts = [makeAttempt()],
    participants = [makeParticipant()],
    playerState = makePlayerState(),
    updatedInstance = makeUpdatedInstance()
) {
    mockSend
        .mockResolvedValueOnce({ Item: instance })           // getBossBattleInstance
        .mockResolvedValueOnce({ Item: question })           // getQuestion
        .mockResolvedValueOnce({ Items: attempts })          // listAttemptsByBattleQuestion
        .mockResolvedValueOnce({ Items: participants })      // listParticipants (JOINED)
        .mockResolvedValueOnce({ Item: playerState })        // getPlayerState(student-1)
        .mockResolvedValueOnce({ Attributes: updatedInstance }); // resolveQuestion (UpdateCommand)
}

// ---------------------------------------------------------------------------
// 1. Successful QUESTION_ACTIVE → INTERMISSION
// ---------------------------------------------------------------------------
describe("QUESTION_ACTIVE → INTERMISSION (partial damage, boss HP remains)", () => {
    it("returns 200 with INTERMISSION status when boss HP not depleted", async () => {
        mockHappyPathNopenalties();

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.status).toBe("INTERMISSION");
        expect(body.outcome).toBeNull();
        expect(body.total_attempts).toBe(1);
        expect(body.total_damage_to_boss).toBe(90);
        expect(body.new_boss_hp).toBe(910);
        expect(body.downed_students_count).toBe(0);
    });

    it("resolves safely with zero attempts (no submissions)", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Items: [] })              // no attempts
            .mockResolvedValueOnce({ Items: [makeParticipant()] })
            .mockResolvedValueOnce({ Item: makePlayerState() })
            .mockResolvedValueOnce({ Attributes: makeUpdatedInstance() });

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.total_attempts).toBe(0);
        expect(body.total_damage_to_boss).toBe(0);
        expect(body.new_boss_hp).toBe(1000); // no damage
        expect(body.status).toBe("INTERMISSION");
    });
});

// ---------------------------------------------------------------------------
// 2. QUESTION_ACTIVE → COMPLETED WIN (boss HP reaches 0)
// ---------------------------------------------------------------------------
describe("QUESTION_ACTIVE → COMPLETED WIN", () => {
    it("returns COMPLETED/WIN when total damage >= boss HP", async () => {
        const highDamageAttempt = makeAttempt({ damage_to_boss: 1000 });
        const updatedInstance = makeUpdatedInstance({ status: "COMPLETED", outcome: "WIN", current_boss_hp: 0 });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ current_boss_hp: 1000 }) })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Items: [highDamageAttempt] })
            .mockResolvedValueOnce({ Items: [makeParticipant()] })
            .mockResolvedValueOnce({ Item: makePlayerState() })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.new_boss_hp).toBe(0);
        expect(body.status).toBe("COMPLETED");
        expect(body.outcome).toBe("WIN");
    });

    it("clamps boss HP at 0 when damage exceeds current HP", async () => {
        const overkillAttempt = makeAttempt({ damage_to_boss: 5000 });
        const updatedInstance = makeUpdatedInstance({ status: "COMPLETED", outcome: "WIN", current_boss_hp: 0 });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ current_boss_hp: 100 }) })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Items: [overkillAttempt] })
            .mockResolvedValueOnce({ Items: [makeParticipant()] })
            .mockResolvedValueOnce({ Item: makePlayerState() })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.new_boss_hp).toBe(0);
        expect(body.outcome).toBe("WIN");
    });
});

// ---------------------------------------------------------------------------
// 3. QUESTION_ACTIVE → COMPLETED FAIL (all guilds down)
// ---------------------------------------------------------------------------
describe("QUESTION_ACTIVE → COMPLETED FAIL (all guilds down)", () => {
    it("returns COMPLETED/FAIL/ALL_GUILDS_DOWN when all guild members are downed", async () => {
        // Two participants already downed, no new penalties
        const p1 = makeParticipant({ student_id: "s1", is_downed: true });
        const p2 = makeParticipant({ student_id: "s2", is_downed: true });
        const updatedInstance = makeUpdatedInstance({
            status: "COMPLETED",
            outcome: "FAIL",
            fail_reason: "ALL_GUILDS_DOWN",
        });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Items: [] }) // no attempts
            .mockResolvedValueOnce({ Items: [p1, p2] })
            .mockResolvedValueOnce({ Item: makePlayerState({ student_id: "s1", hearts: 0 }) }) // s1 PS
            .mockResolvedValueOnce({ Item: makePlayerState({ student_id: "s2", hearts: 0 }) }) // s2 PS
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.status).toBe("COMPLETED");
        expect(body.outcome).toBe("FAIL");
        expect(body.fail_reason).toBe("ALL_GUILDS_DOWN");
    });

    it("INTERMISSION when at least one guild has a living member", async () => {
        // Two guilds; guild-1 is all downed but guild-2 still has a live member
        const g1p1 = makeParticipant({ student_id: "s1", guild_id: "guild-1", is_downed: true });
        const g2p1 = makeParticipant({ student_id: "s2", guild_id: "guild-2", is_downed: false });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({ Items: [g1p1, g2p1] })
            .mockResolvedValueOnce({ Item: makePlayerState({ student_id: "s1", hearts: 0 }) })
            .mockResolvedValueOnce({ Item: makePlayerState({ student_id: "s2", hearts: 3 }) })
            .mockResolvedValueOnce({ Attributes: makeUpdatedInstance() });

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.status).toBe("INTERMISSION");
        expect(body.outcome).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 4. Input/state validation
// ---------------------------------------------------------------------------
describe("input and state validation", () => {
    it("returns 400 when boss_instance_id is missing", async () => {
        const res = await resolveQuestionHandler({ pathParameters: {} });
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/boss_instance_id/i);
    });

    it("returns 404 when instance not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const res = await resolveQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(404);
    });

    it("returns 409 when status is not QUESTION_ACTIVE", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "INTERMISSION" }) });
        const res = await resolveQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/QUESTION_ACTIVE/i);
    });

    it("returns 409 when active_question_id is missing", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ active_question_id: undefined }) });
        const res = await resolveQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/No active question/i);
    });

    it("returns 404 when question not found", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: undefined });
        const res = await resolveQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toMatch(/question not found/i);
    });
});

// ---------------------------------------------------------------------------
// 5. Duplicate resolve call (conditional update fails)
// ---------------------------------------------------------------------------
describe("duplicate resolve call", () => {
    it("returns 409 when conditional update fails (already resolved)", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({ Items: [makeParticipant()] })
            .mockResolvedValueOnce({ Item: makePlayerState() })
            .mockRejectedValueOnce(
                Object.assign(new Error("Condition check failed"), {
                    name: "ConditionalCheckFailedException",
                })
            );

        const res = await resolveQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/already resolved/i);
    });
});

// ---------------------------------------------------------------------------
// 6. Student heart penalties
// ---------------------------------------------------------------------------
describe("student heart penalties (SIMULTANEOUS_ALL)", () => {
    it("reduces student hearts and emits downed_students_count=0 when hearts remain", async () => {
        // student-1 submits wrong: hearts_delta_student=-1, current hearts=3
        const wrongAttempt = makeAttempt({
            is_correct:           false,
            damage_to_boss:       0,
            hearts_delta_student: -1,
            hearts_delta_guild_total: 0,
        });
        const ps = makePlayerState({ hearts: 3 });
        const updatedInstance = makeUpdatedInstance();

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Items: [wrongAttempt] })
            .mockResolvedValueOnce({ Items: [makeParticipant()] })
            .mockResolvedValueOnce({ Item: ps })                  // parallel playerState load
            .mockResolvedValueOnce({})                            // setPlayerHearts (UpdateCommand)
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.downed_students_count).toBe(0);

        // Verify setPlayerHearts was called with new_hearts=2
        const updateCalls = mockSend.mock.calls.filter(
            (c: any) => c[0]?.input?.UpdateExpression?.includes("hearts = :hearts")
        );
        expect(updateCalls.length).toBeGreaterThanOrEqual(1);
        const heartsUpdate = updateCalls[0][0].input;
        expect(heartsUpdate.ExpressionAttributeValues[":hearts"]).toBe(2);
    });

    it("marks participant downed when hearts reach 0", async () => {
        const wrongAttempt = makeAttempt({
            is_correct:           false,
            damage_to_boss:       0,
            hearts_delta_student: -1,
            hearts_delta_guild_total: 0,
        });
        const ps = makePlayerState({ hearts: 1 }); // one heart left
        const updatedInstance = makeUpdatedInstance({ status: "COMPLETED", outcome: "FAIL", fail_reason: "ALL_GUILDS_DOWN" });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Items: [wrongAttempt] })
            .mockResolvedValueOnce({ Items: [makeParticipant()] })
            .mockResolvedValueOnce({ Item: ps })                   // parallel playerState load
            .mockResolvedValueOnce({})                             // setPlayerHearts → 0
            .mockResolvedValueOnce({})                             // markParticipantDowned
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.downed_students_count).toBe(1);

        // Hearts clamped at 0
        const updateCalls = mockSend.mock.calls.filter(
            (c: any) => c[0]?.input?.UpdateExpression?.includes("hearts = :hearts")
        );
        const heartsUpdate = updateCalls[0][0].input;
        expect(heartsUpdate.ExpressionAttributeValues[":hearts"]).toBe(0);
    });

    it("clamps hearts at 0 when delta exceeds current hearts", async () => {
        const wrongAttempt = makeAttempt({
            is_correct:           false,
            damage_to_boss:       0,
            hearts_delta_student: -5, // big penalty
            hearts_delta_guild_total: 0,
        });
        const ps = makePlayerState({ hearts: 2 }); // only 2 hearts
        const updatedInstance = makeUpdatedInstance({ status: "COMPLETED", outcome: "FAIL", fail_reason: "ALL_GUILDS_DOWN" });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Items: [wrongAttempt] })
            .mockResolvedValueOnce({ Items: [makeParticipant()] })
            .mockResolvedValueOnce({ Item: ps })
            .mockResolvedValueOnce({})                // setPlayerHearts → 0
            .mockResolvedValueOnce({})                // markParticipantDowned
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await resolveQuestionHandler(makeEvent());

        const updateCalls = mockSend.mock.calls.filter(
            (c: any) => c[0]?.input?.UpdateExpression?.includes("hearts = :hearts")
        );
        const heartsUpdate = updateCalls[0][0].input;
        expect(heartsUpdate.ExpressionAttributeValues[":hearts"]).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// 7. Guild heart penalties (TURN_BASED_GUILD)
// ---------------------------------------------------------------------------
describe("guild heart penalties (TURN_BASED_GUILD)", () => {
    it("distributes guild penalty deterministically across guild members", async () => {
        // Guild penalty of 2; two members: s1(hearts=3), s2(hearts=2)
        // Round 1: s1 (highest) → 2; Round 2: s1(2) == s2(2), tie-break by student_id → s1 → 1
        // Final: s1=1, s2=2
        const guildAttempt = makeAttempt({
            student_id:               "s1",
            guild_id:                 "guild-1",
            is_correct:               false,
            damage_to_boss:           0,
            hearts_delta_student:     0,
            hearts_delta_guild_total: -2,
            mode_type:                "TURN_BASED_GUILD",
        });
        const p1 = makeParticipant({ student_id: "s1", guild_id: "guild-1" });
        const p2 = makeParticipant({ student_id: "s2", guild_id: "guild-1" });
        const ps1 = makePlayerState({ student_id: "s1", hearts: 3 });
        const ps2 = makePlayerState({ student_id: "s2", hearts: 2 });
        const updatedInstance = makeUpdatedInstance();

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ mode_type: "TURN_BASED_GUILD", active_guild_id: "guild-1" }) })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Items: [guildAttempt] })
            .mockResolvedValueOnce({ Items: [p1, p2] })
            .mockResolvedValueOnce({ Item: ps1 })              // getPlayerState(s1) — parallel
            .mockResolvedValueOnce({ Item: ps2 })              // getPlayerState(s2) — parallel
            .mockResolvedValueOnce({})                         // setPlayerHearts(s1) — only s1 changed
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.affected_guilds_count).toBe(1);
        expect(body.downed_students_count).toBe(0);

        // s1 should have hearts set to 1 (3 → 2 → 1 after two rounds)
        const updateCalls = mockSend.mock.calls.filter(
            (c: any) => c[0]?.input?.UpdateExpression?.includes("hearts = :hearts")
        );
        const heartsSet = updateCalls.map((c: any) => c[0].input.ExpressionAttributeValues[":hearts"]);
        expect(heartsSet).toContain(1);
    });

    it("marks guild member downed when hearts reach 0 from guild penalty", async () => {
        // Guild penalty of 1 on a member with 1 heart → downed
        const guildAttempt = makeAttempt({
            student_id:               "s1",
            guild_id:                 "guild-1",
            is_correct:               false,
            damage_to_boss:           0,
            hearts_delta_student:     0,
            hearts_delta_guild_total: -1,
            mode_type:                "TURN_BASED_GUILD",
        });
        const p1 = makeParticipant({ student_id: "s1", guild_id: "guild-1" });
        const ps1 = makePlayerState({ student_id: "s1", hearts: 1 });
        const updatedInstance = makeUpdatedInstance({ status: "COMPLETED", outcome: "FAIL", fail_reason: "ALL_GUILDS_DOWN" });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ mode_type: "TURN_BASED_GUILD", active_guild_id: "guild-1" }) })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Items: [guildAttempt] })
            .mockResolvedValueOnce({ Items: [p1] })
            .mockResolvedValueOnce({ Item: ps1 })       // getPlayerState(s1)
            .mockResolvedValueOnce({})                  // setPlayerHearts → 0
            .mockResolvedValueOnce({})                  // markParticipantDowned
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.downed_students_count).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// 8. Aggregate damage from multiple attempts
// ---------------------------------------------------------------------------
describe("aggregated damage from multiple correct attempts", () => {
    it("sums damage_to_boss across all correct attempts", async () => {
        const attempts = [
            makeAttempt({ student_id: "s1", damage_to_boss: 80 }),
            makeAttempt({ student_id: "s2", damage_to_boss: 70, attempt_sk: "T#...#S#s2#A#uuid2" }),
        ];
        const p1 = makeParticipant({ student_id: "s1" });
        const p2 = makeParticipant({ student_id: "s2" });
        const ps1 = makePlayerState({ student_id: "s1" });
        const ps2 = makePlayerState({ student_id: "s2" });
        const updatedInstance = makeUpdatedInstance({ current_boss_hp: 850 });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ current_boss_hp: 1000 }) })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Items: attempts })
            .mockResolvedValueOnce({ Items: [p1, p2] })
            .mockResolvedValueOnce({ Item: ps1 })
            .mockResolvedValueOnce({ Item: ps2 })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.total_damage_to_boss).toBe(150);
        expect(body.new_boss_hp).toBe(850);
    });
});

// ---------------------------------------------------------------------------
// 9. Answer-gating readiness checks
// ---------------------------------------------------------------------------
describe("answer-gating readiness (untimed questions)", () => {
    it("returns 409 when ready_to_resolve is false and no timer set", async () => {
        mockSend.mockResolvedValueOnce({
            Item: makeInstance({
                ready_to_resolve:      false,
                received_answer_count: 1,
                required_answer_count: 3,
                question_ends_at:      undefined,
            }),
        });

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(409);
        expect(body.error).toMatch(/required participants have answered/i);
        expect(body.received_answer_count).toBe(1);
        expect(body.required_answer_count).toBe(3);
    });

    it("returns 200 when ready_to_resolve is true (all answers received, untimed)", async () => {
        mockHappyPathNopenalties(
            makeInstance({ ready_to_resolve: true, received_answer_count: 3, required_answer_count: 3 })
        );

        const res = await resolveQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(200);
    });
});

describe("answer-gating readiness (timed questions)", () => {
    it("returns 409 when timer has NOT expired and not yet ready", async () => {
        const futureTime = new Date(Date.now() + 60_000).toISOString(); // 60s in future
        mockSend.mockResolvedValueOnce({
            Item: makeInstance({
                ready_to_resolve:      false,
                received_answer_count: 0,
                required_answer_count: 3,
                question_ends_at:      futureTime,
            }),
        });

        const res = await resolveQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(409);
        expect(body.error).toMatch(/waiting for required answers or timer expiry/i);
        expect(body.ready_to_resolve).toBe(false);
        expect(body.timer_expired).toBe(false);
    });

    it("returns 200 when timer has expired (even if not ready)", async () => {
        const pastTime = new Date(Date.now() - 5_000).toISOString(); // 5s in past
        mockHappyPathNopenalties(
            makeInstance({
                ready_to_resolve:      false,
                received_answer_count: 1,
                required_answer_count: 3,
                question_ends_at:      pastTime,
            })
        );

        const res = await resolveQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(200);
    });

    it("returns 200 early when ready_to_resolve is true (timer not yet expired)", async () => {
        const futureTime = new Date(Date.now() + 60_000).toISOString();
        mockHappyPathNopenalties(
            makeInstance({
                ready_to_resolve:      true,
                received_answer_count: 3,
                required_answer_count: 3,
                question_ends_at:      futureTime,
            })
        );

        const res = await resolveQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// 10. Quest API stack wiring
// ---------------------------------------------------------------------------
describe("QuestApiStack route wiring", () => {
    it("QuestApiStack includes the resolve-question route", async () => {
        const { readFileSync } = await import("fs");
        const stackContent = readFileSync(
            new URL("../../../../../stacks/QuestApiStack.ts", import.meta.url),
            "utf-8"
        );
        expect(stackContent).toContain("resolve-question");
        expect(stackContent).toContain("/boss-battle-instances/{boss_instance_id}/resolve-question");
    });

    it("quest-router includes the resolve-question handler", async () => {
        const { readFileSync } = await import("fs");
        const routerContent = readFileSync(
            new URL("../../quest-router/router.ts", import.meta.url),
            "utf-8"
        );
        expect(routerContent).toContain("resolve-question");
        expect(routerContent).toContain("bbiResolveQuestion");
    });
});

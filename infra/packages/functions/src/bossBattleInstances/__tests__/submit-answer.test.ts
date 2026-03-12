/**
 * Unit tests for the SubmitBossAnswer handler.
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
// Mock auto-resolve (prevents DynamoDB side-effects in submit tests;
// auto-resolve behaviour tested separately in the dedicated describe block below)
// ---------------------------------------------------------------------------
const mockTryAutoResolve = vi.fn();

vi.mock("../auto-resolve.js", () => ({
    tryAutoResolveBossQuestion: mockTryAutoResolve,
}));

// ---------------------------------------------------------------------------
// Module reference
// ---------------------------------------------------------------------------
let submitAnswerHandler: (typeof import("../submit-answer.ts"))["handler"];

beforeAll(async () => {
    process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME    = "test-bbi";
    process.env.BOSS_BATTLE_TEMPLATES_TABLE_NAME    = "test-bbt";
    process.env.BOSS_QUESTIONS_TABLE_NAME           = "test-bq";
    process.env.BOSS_BATTLE_PARTICIPANTS_TABLE_NAME = "test-bbp";
    process.env.BOSS_ANSWER_ATTEMPTS_TABLE_NAME     = "test-baa";

    submitAnswerHandler = (await import("../submit-answer.ts")).handler;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeInstance(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id:                 "inst-1",
        class_id:                         "class-1",
        boss_template_id:                 "tpl-1",
        created_by_teacher_id:            "teacher-1",
        status:                           "QUESTION_ACTIVE",
        mode_type:                        "SIMULTANEOUS_ALL",
        active_question_id:               "q-1",
        question_started_at:              new Date(Date.now() - 5000).toISOString(),
        question_ends_at:                 new Date(Date.now() + 25000).toISOString(),
        speed_bonus_enabled:              true,
        speed_bonus_floor_multiplier:     0.2,
        speed_window_seconds:             30,
        time_limit_seconds_default:       null,
        anti_spam_min_submit_interval_ms: 1000,
        freeze_on_wrong_seconds:          3,
        current_question_index:           0,
        initial_boss_hp:                  1000,
        current_boss_hp:                  1000,
        created_at:                       "2026-01-01T00:00:00.000Z",
        updated_at:                       "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeQuestion(overrides: Record<string, any> = {}) {
    return {
        question_id:                  "q-1",
        boss_template_id:             "tpl-1",
        question_type:                "MCQ_SINGLE",
        question_text:                "What is 2+2?",
        options:                      ["2", "4", "6", "8"],
        correct_answer:               "4",
        auto_gradable:                true,
        time_limit_seconds:           30,
        damage_to_boss_on_correct:    100,
        damage_to_guild_on_incorrect: 50,
        order_index:                  0,
        order_key:                    "000001",
        created_at:                   "2026-01-01T00:00:00.000Z",
        updated_at:                   "2026-01-01T00:00:00.000Z",
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
        last_submit_at:   null,
        frozen_until:     null,
        created_at:       "2026-01-01T00:00:00.000Z",
        updated_at:       "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeEvent(overrides: Record<string, any> = {}, body: Record<string, any> = {}) {
    return {
        pathParameters: { boss_instance_id: "inst-1", ...overrides.pathParameters },
        body: JSON.stringify({
            answer_raw:  { value: "4" },
            ...body,
        }),
        requestContext: {
            authorizer: {
                jwt: {
                    claims: {
                        sub: "student-1",
                        "cognito:groups": "Students",
                    },
                },
            },
        },
        ...overrides,
    };
}

/**
 * Wire up mockSend for the "happy path":
 * Call order:
 *   1. GetCommand → instance
 *   2. GetCommand → question
 *   3. GetCommand → participant
 *   4. QueryCommand → duplicate check (empty)
 *   5. PutCommand → create attempt (no return needed)
 *   6. UpdateCommand → anti-spam update
 *   7. UpdateCommand → incrementAnswerCount (returns updated instance)
 */
function mockHappyPath(
    instance = makeInstance(),
    question = makeQuestion(),
    participant = makeParticipant()
) {
    mockSend
        .mockResolvedValueOnce({ Item: instance })      // getBossBattleInstance
        .mockResolvedValueOnce({ Item: question })      // getQuestion
        .mockResolvedValueOnce({ Item: participant })   // getParticipant
        .mockResolvedValueOnce({ Items: [] })           // getStudentAttemptForQuestion (no duplicate)
        .mockResolvedValueOnce({})                      // createBossAnswerAttempt (PutCommand)
        .mockResolvedValueOnce({})                      // updateAntiSpamFields (UpdateCommand)
        .mockResolvedValueOnce({ Attributes: {         // incrementAnswerCount (UpdateCommand)
            ...instance,
            received_answer_count: 1,
            required_answer_count: 0,  // 0 → setReadyToResolve not called
        }});
}

beforeEach(() => {
    mockSend.mockReset();
    // Default: auto-resolve succeeds (safe default; overridden per test in dedicated suite)
    mockTryAutoResolve.mockResolvedValue({ auto_resolve_status: "resolved" });
});

// ---------------------------------------------------------------------------
// 1. Successful submission
// ---------------------------------------------------------------------------
describe("successful submit on active question", () => {
    it("returns 200 with correct grading and effects", async () => {
        mockHappyPath();

        const res = await submitAnswerHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.is_correct).toBe(true);
        expect(body.damage_to_boss).toBeGreaterThan(0);
        expect(body.hearts_delta_student).toBe(0);
        expect(body.hearts_delta_guild_total).toBe(0);
        expect(body.elapsed_seconds).toBeGreaterThanOrEqual(0);
        expect(body.speed_multiplier).toBeGreaterThan(0);
        expect(body.speed_multiplier).toBeLessThanOrEqual(1);
        expect(body.frozen_until).toBeNull();
        expect(body.answered_at).toBeDefined();
    });

    it("returns is_correct=false for wrong answer", async () => {
        mockHappyPath();

        const res = await submitAnswerHandler(makeEvent({}, { student_id: "student-1", answer_raw: { value: "2" } }));
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.is_correct).toBe(false);
        expect(body.damage_to_boss).toBe(0);
        expect(body.hearts_delta_student).toBe(-1);
        expect(body.hearts_delta_guild_total).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// 2. Status validation
// ---------------------------------------------------------------------------
describe("reject when status != QUESTION_ACTIVE", () => {
    const invalidStatuses = ["DRAFT", "LOBBY", "COUNTDOWN", "RESOLVING", "INTERMISSION", "COMPLETED", "ABORTED"];

    for (const status of invalidStatuses) {
        it(`returns 409 when status is ${status}`, async () => {
            mockSend.mockResolvedValueOnce({ Item: makeInstance({ status }) });

            const res = await submitAnswerHandler(makeEvent());
            expect(res.statusCode).toBe(409);
            expect(JSON.parse(res.body).error).toMatch(/QUESTION_ACTIVE/);
        });
    }

    it("returns 404 when instance not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toMatch(/instance not found/i);
    });

    it("returns 409 when active_question_id is missing", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ active_question_id: undefined }) });

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/No active question/i);
    });
});

// ---------------------------------------------------------------------------
// 3. Input validation
// ---------------------------------------------------------------------------
describe("input validation", () => {
    it("returns 400 when boss_instance_id is missing", async () => {
        const res = await submitAnswerHandler({ pathParameters: {}, body: JSON.stringify({ answer_raw: { value: "4" } }) });
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/boss_instance_id/i);
    });

    it("returns 401 when JWT sub is missing", async () => {
        const event = { pathParameters: { boss_instance_id: "inst-1" }, body: JSON.stringify({ answer_raw: { value: "4" } }) };
        const res = await submitAnswerHandler(event);
        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body).error).toMatch(/unauthorized/i);
    });

    it("returns 400 when answer_raw is not an object", async () => {
        const event = makeEvent({}, { answer_raw: "bad" });
        const res = await submitAnswerHandler(event);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/answer_raw/i);
    });

    it("returns 400 when answer_raw is an array", async () => {
        const event = makeEvent({}, { answer_raw: ["a", "b"] });
        const res = await submitAnswerHandler(event);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/answer_raw/i);
    });
});

// ---------------------------------------------------------------------------
// 4. Participant validation
// ---------------------------------------------------------------------------
describe("participant validation", () => {
    it("returns 404 when participant not found", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: undefined });

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toMatch(/participant not found/i);
    });

    it("returns 409 when participant state is not JOINED", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant({ state: "SPECTATE" }) });

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/JOINED/i);
    });

    it("returns 409 when participant is downed", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant({ is_downed: true }) });

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/downed/i);
    });

    it("returns 409 when participant is frozen", async () => {
        const frozenUntil = new Date(Date.now() + 10000).toISOString();
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant({ frozen_until: frozenUntil }) });

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/frozen/i);
    });

    it("allows submission after frozen_until has passed", async () => {
        const pastFrozen = new Date(Date.now() - 5000).toISOString();
        mockHappyPath(
            makeInstance(),
            makeQuestion(),
            makeParticipant({ frozen_until: pastFrozen })
        );

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);
    });

    it("returns 409 when anti-spam interval not elapsed", async () => {
        const recentSubmit = new Date(Date.now() - 500).toISOString(); // 500ms ago, interval = 1000ms
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant({ last_submit_at: recentSubmit }) });

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/anti-spam/i);
    });
});

// ---------------------------------------------------------------------------
// 5. Duplicate submission
// ---------------------------------------------------------------------------
describe("duplicate submission", () => {
    it("returns 409 when student already answered this question", async () => {
        const existingAttempt = {
            boss_attempt_pk: "BI#inst-1#Q#q-1",
            attempt_sk:      "T#2026-01-01T00:00:00.000Z#S#student-1#A#uuid",
            student_id:      "student-1",
            is_correct:      true,
        };

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [existingAttempt] }); // duplicate detected

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/duplicate/i);
    });
});

// ---------------------------------------------------------------------------
// 6. Late submission
// ---------------------------------------------------------------------------
describe("late submission", () => {
    it("returns 409 when question time has expired", async () => {
        const expiredEndsAt = new Date(Date.now() - 1000).toISOString();
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ question_ends_at: expiredEndsAt }) })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [] }); // no duplicate

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/too late/i);
    });

    it("allows submission when question has no end time (untimed)", async () => {
        mockHappyPath(makeInstance({ question_ends_at: undefined }));

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// 7. Speed multiplier — timed question
// ---------------------------------------------------------------------------
describe("speed multiplier — timed question", () => {
    it("computes multiplier from question time_limit_seconds", async () => {
        // question started 5s ago, limit = 30s => elapsed=5, raw = 1 - 5/30 ≈ 0.833
        const startedAt = new Date(Date.now() - 5000).toISOString();
        const question = makeQuestion({ time_limit_seconds: 30 });

        mockHappyPath(makeInstance({ question_started_at: startedAt }), question);

        const res = await submitAnswerHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.effective_time_limit_seconds).toBe(30);
        expect(body.speed_multiplier).toBeGreaterThan(0.8);
        expect(body.speed_multiplier).toBeLessThanOrEqual(1);
    });

    it("clamps multiplier to floor when elapsed > window", async () => {
        // started 60s ago, limit = 30s, floor = 0.2 => clamped to 0.2
        const startedAt = new Date(Date.now() - 60000).toISOString();
        const question = makeQuestion({ time_limit_seconds: 30 });

        mockHappyPath(makeInstance({
            question_started_at:          startedAt,
            speed_bonus_floor_multiplier: 0.2,
        }), question);

        const res = await submitAnswerHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.speed_multiplier).toBe(0.2);
    });
});

// ---------------------------------------------------------------------------
// 8. Speed multiplier — untimed question
// ---------------------------------------------------------------------------
describe("speed multiplier — untimed question", () => {
    it("uses instance speed_window_seconds when no time limit set", async () => {
        // no time_limit on question or instance default; use speed_window_seconds=30
        const startedAt = new Date(Date.now() - 10000).toISOString();
        const question = makeQuestion({ time_limit_seconds: undefined });

        mockHappyPath(
            makeInstance({
                question_started_at:      startedAt,
                time_limit_seconds_default: null,
                speed_window_seconds:     30,
            }),
            question
        );

        const res = await submitAnswerHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.effective_time_limit_seconds).toBeNull();
        expect(body.speed_multiplier).toBeGreaterThan(0);
        expect(body.speed_multiplier).toBeLessThanOrEqual(1);
    });

    it("speed_multiplier = 1 when speed_bonus_enabled = false", async () => {
        const startedAt = new Date(Date.now() - 10000).toISOString();

        mockHappyPath(
            makeInstance({ question_started_at: startedAt, speed_bonus_enabled: false })
        );

        const res = await submitAnswerHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.speed_multiplier).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// 9. Wrong answer cooldown
// ---------------------------------------------------------------------------
describe("wrong answer cooldown", () => {
    it("sets frozen_until when answer is wrong and freeze_on_wrong_seconds > 0", async () => {
        const beforeRequest = Date.now();
        mockHappyPath(
            makeInstance({ freeze_on_wrong_seconds: 5 }),
            makeQuestion(),
            makeParticipant()
        );

        const res = await submitAnswerHandler(makeEvent({}, { student_id: "student-1", answer_raw: { value: "wrong" } }));
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.is_correct).toBe(false);
        expect(body.frozen_until).not.toBeNull();
        const frozenUntilMs = new Date(body.frozen_until).getTime();
        expect(frozenUntilMs).toBeGreaterThan(beforeRequest + 4000);
    });

    it("frozen_until is null when freeze_on_wrong_seconds = 0", async () => {
        mockHappyPath(
            makeInstance({ freeze_on_wrong_seconds: 0 }),
            makeQuestion(),
            makeParticipant()
        );

        const res = await submitAnswerHandler(makeEvent({}, { student_id: "student-1", answer_raw: { value: "wrong" } }));
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.is_correct).toBe(false);
        expect(body.frozen_until).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 10. TURN_BASED_GUILD — wrong guild rejection
// ---------------------------------------------------------------------------
describe("TURN_BASED_GUILD mode", () => {
    it("returns 409 when participant is not in the active guild", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ mode_type: "TURN_BASED_GUILD", active_guild_id: "guild-active" }) })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant({ guild_id: "guild-other" }) })
            .mockResolvedValueOnce({ Items: [] }); // no duplicate

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/active guild/i);
    });

    it("allows submission when participant is in the active guild", async () => {
        mockHappyPath(
            makeInstance({ mode_type: "TURN_BASED_GUILD", active_guild_id: "guild-1" }),
            makeQuestion(),
            makeParticipant({ guild_id: "guild-1" })
        );

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);
    });

    it("allows submission when active_guild_id is not set (no guild restriction)", async () => {
        mockHappyPath(
            makeInstance({ mode_type: "TURN_BASED_GUILD", active_guild_id: undefined }),
            makeQuestion(),
            makeParticipant({ guild_id: "guild-1" })
        );

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);
    });

    it("stores hearts_delta_guild_total = -damage_to_guild_on_incorrect for wrong answer", async () => {
        mockHappyPath(
            makeInstance({ mode_type: "TURN_BASED_GUILD", active_guild_id: "guild-1" }),
            makeQuestion({ damage_to_guild_on_incorrect: 50 }),
            makeParticipant({ guild_id: "guild-1" })
        );

        const res = await submitAnswerHandler(makeEvent({}, { student_id: "student-1", answer_raw: { value: "wrong" } }));
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.is_correct).toBe(false);
        expect(body.hearts_delta_guild_total).toBe(-50);
        expect(body.hearts_delta_student).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// 11. Damage and hearts delta by mode
// ---------------------------------------------------------------------------
describe("damage_to_boss and hearts_delta shapes by mode", () => {
    it("correct answer stores damage_to_boss > 0 and zero hearts deltas", async () => {
        mockHappyPath(
            makeInstance(),
            makeQuestion({ damage_to_boss_on_correct: 100 }),
            makeParticipant()
        );

        const res = await submitAnswerHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.damage_to_boss).toBeGreaterThan(0);
        expect(body.hearts_delta_student).toBe(0);
        expect(body.hearts_delta_guild_total).toBe(0);
    });

    it("SIMULTANEOUS_ALL wrong: hearts_delta_student=-1, guild=0, boss=0", async () => {
        mockHappyPath(
            makeInstance({ mode_type: "SIMULTANEOUS_ALL" }),
            makeQuestion(),
            makeParticipant()
        );

        const res = await submitAnswerHandler(makeEvent({}, { student_id: "student-1", answer_raw: { value: "wrong" } }));
        const body = JSON.parse(res.body);

        expect(body.damage_to_boss).toBe(0);
        expect(body.hearts_delta_student).toBe(-1);
        expect(body.hearts_delta_guild_total).toBe(0);
    });

    it("RANDOMIZED_PER_GUILD wrong: hearts_delta_student=-1, guild=0, boss=0", async () => {
        mockHappyPath(
            makeInstance({ mode_type: "RANDOMIZED_PER_GUILD" }),
            makeQuestion(),
            makeParticipant()
        );

        const res = await submitAnswerHandler(makeEvent({}, { student_id: "student-1", answer_raw: { value: "wrong" } }));
        const body = JSON.parse(res.body);

        expect(body.damage_to_boss).toBe(0);
        expect(body.hearts_delta_student).toBe(-1);
        expect(body.hearts_delta_guild_total).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// 12. Question not auto-gradable
// ---------------------------------------------------------------------------
describe("question auto-gradable check", () => {
    it("returns 409 when question is not auto_gradable", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion({ auto_gradable: false }) });

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/auto-gradable/i);
    });

    it("returns 404 when question not found", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: undefined });

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toMatch(/question not found/i);
    });
});

// ---------------------------------------------------------------------------
// 13. Grading — question types
// ---------------------------------------------------------------------------
describe("auto-grading by question type", () => {
    async function gradeTest(questionType: string, correctAnswer: any, submittedValue: any, expectedCorrect: boolean) {
        mockHappyPath(
            makeInstance(),
            makeQuestion({ question_type: questionType, correct_answer: correctAnswer }),
            makeParticipant()
        );
        const res = await submitAnswerHandler(makeEvent({}, { student_id: "student-1", answer_raw: { value: submittedValue } }));
        const body = JSON.parse(res.body);
        expect(res.statusCode).toBe(200);
        expect(body.is_correct).toBe(expectedCorrect);
        mockSend.mockReset();
    }

    it("MCQ_SINGLE: exact match is correct", async () => {
        await gradeTest("MCQ_SINGLE", "4", "4", true);
    });

    it("MCQ_SINGLE: wrong value is incorrect", async () => {
        await gradeTest("MCQ_SINGLE", "4", "2", false);
    });

    it("TRUE_FALSE: 'true' matches 'true'", async () => {
        await gradeTest("TRUE_FALSE", "true", "true", true);
    });

    it("MCQ_MULTI: matching sorted arrays is correct", async () => {
        await gradeTest("MCQ_MULTI", ["a", "b"], ["b", "a"], true);
    });

    it("MCQ_MULTI: different arrays is incorrect", async () => {
        await gradeTest("MCQ_MULTI", ["a", "b"], ["a", "c"], false);
    });

    it("SHORT_ANSWER: case-insensitive match is correct", async () => {
        await gradeTest("SHORT_ANSWER", "Paris", "paris", true);
    });

    it("NUMERIC: matching numbers is correct", async () => {
        await gradeTest("NUMERIC", 42, "42", true);
    });

    it("NUMERIC: wrong number is incorrect", async () => {
        await gradeTest("NUMERIC", 42, "43", false);
    });
});

// ---------------------------------------------------------------------------
// 14. Answer-gating quorum counters
// ---------------------------------------------------------------------------
describe("answer-gating quorum counters", () => {
    /** mockHappyPathWithQuorum: like mockHappyPath but allows custom incrementAnswerCount return */
    function mockHappyPathWithQuorum(
        instance = makeInstance(),
        quorumResult: Record<string, any> = {}
    ) {
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: { ...instance, ...quorumResult } });
    }

    it("response body includes received_answer_count, required_answer_count, ready_to_resolve", async () => {
        mockHappyPathWithQuorum(makeInstance(), {
            received_answer_count: 1,
            required_answer_count: 3,
            ready_to_resolve: false,
        });

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.received_answer_count).toBe(1);
        expect(body.required_answer_count).toBe(3);
        expect(body.ready_to_resolve).toBe(false);
    });

    it("ready_to_resolve is false when required_answer_count not yet reached", async () => {
        mockHappyPathWithQuorum(makeInstance(), {
            received_answer_count: 2,
            required_answer_count: 3,
            ready_to_resolve: false,
        });

        const res = await submitAnswerHandler(makeEvent());
        expect(JSON.parse(res.body).ready_to_resolve).toBe(false);
        // setReadyToResolve should NOT have been called (no extra UpdateCommand beyond incrementAnswerCount)
        const updateCalls = mockSend.mock.calls.filter(
            (c) => c[0]?.constructor?.name === "UpdateCommand" || c[0]?.input?.UpdateExpression
        );
        // 3 UpdateCommands: anti-spam + incrementAnswerCount (no setReadyToResolve)
        expect(mockSend).toHaveBeenCalledTimes(7);
    });

    it("SIMULTANEOUS_ALL: ready_to_resolve becomes true when all required participants answered", async () => {
        // received = required = 3 → setReadyToResolve is called (8th mock)
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ required_answer_count: 3 }) })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: {
                ...makeInstance(),
                received_answer_count: 3,
                required_answer_count: 3,
                ready_to_resolve: false, // still false — handler will call setReadyToResolve
            }})
            .mockResolvedValueOnce({}); // setReadyToResolve

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).ready_to_resolve).toBe(true);
        expect(mockSend).toHaveBeenCalledTimes(8);
    });

    it("SIMULTANEOUS_ALL: setReadyToResolve NOT called when already ready_to_resolve=true on instance", async () => {
        // Instance already has ready_to_resolve=true — no extra setReadyToResolve call
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: {
                ...makeInstance(),
                received_answer_count: 4,
                required_answer_count: 3,
                ready_to_resolve: true, // already true
            }});

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).ready_to_resolve).toBe(true);
        expect(mockSend).toHaveBeenCalledTimes(7); // no 8th call
    });

    it("RANDOMIZED_PER_GUILD: per-guild count incremented and ready flag set when guild quorum met", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ mode_type: "RANDOMIZED_PER_GUILD" }) })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant({ guild_id: "guild-1" }) })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: {
                ...makeInstance({ mode_type: "RANDOMIZED_PER_GUILD" }),
                received_answer_count: 2,
                required_answer_count: 2,
                per_guild_required_answer_count: { "guild-1": 2 },
                per_guild_received_answer_count: { "guild-1": 2 },
                ready_to_resolve: false,
            }})
            .mockResolvedValueOnce({}); // setReadyToResolve

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).ready_to_resolve).toBe(true);
        expect(mockSend).toHaveBeenCalledTimes(8);
    });

    it("duplicate submission does not increment count (rejected before incrementAnswerCount)", async () => {
        // Duplicate check returns existing attempt → 409 before increment
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [{ student_id: "student-1", is_correct: true }] }); // duplicate

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        // Only 4 mockSend calls — incrementAnswerCount never reached
        expect(mockSend).toHaveBeenCalledTimes(4);
    });
});

// ---------------------------------------------------------------------------
// 15. Auto-resolve path (A–G from spec)
// ---------------------------------------------------------------------------
describe("auto-resolve path", () => {
    /** Shared helper: happy-path mocks for quorum tests.
     *  Returns updated instance attrs that callers can override. */
    function mockForQuorum(
        instance: Record<string, any>,
        quorumAttrs: Record<string, any>
    ) {
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [] })        // no duplicate
            .mockResolvedValueOnce({})                   // createBossAnswerAttempt
            .mockResolvedValueOnce({})                   // updateAntiSpamFields
            .mockResolvedValueOnce({ Attributes: { ...instance, ...quorumAttrs } }); // incrementAnswerCount
    }

    // -------------------------------------------------------------------------
    // A) Submit without quorum → auto_resolve_status = "not_needed"
    // -------------------------------------------------------------------------
    it("A) submit without quorum — does not attempt auto-resolve", async () => {
        mockTryAutoResolve.mockReset(); // ensure it hasn't been called

        mockForQuorum(makeInstance(), {
            received_answer_count: 1,
            required_answer_count: 3,
            ready_to_resolve: false,
        });

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);

        const body = JSON.parse(res.body);
        expect(body.ready_to_resolve).toBe(false);
        expect(body.quorum_reached).toBe(false);
        expect(body.auto_resolve_attempted).toBe(false);
        expect(body.auto_resolve_status).toBe("not_needed");
        expect(mockTryAutoResolve).not.toHaveBeenCalled();
        // DynamoDB calls: 7 (no setReadyToResolve, no auto-resolve DB calls)
        expect(mockSend).toHaveBeenCalledTimes(7);
    });

    // -------------------------------------------------------------------------
    // B) Submit that reaches quorum (untimed) → auto-resolve attempted and succeeds
    // -------------------------------------------------------------------------
    it("B) submit reaches quorum — auto-resolve attempted and succeeds", async () => {
        mockTryAutoResolve.mockResolvedValue({ auto_resolve_status: "resolved" });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ question_ends_at: undefined }) }) // untimed
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: {
                ...makeInstance({ question_ends_at: undefined }),
                received_answer_count: 3,
                required_answer_count: 3,
                ready_to_resolve: false,
            }})
            .mockResolvedValueOnce({}); // setReadyToResolve

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);

        const body = JSON.parse(res.body);
        expect(body.ready_to_resolve).toBe(true);
        expect(body.quorum_reached).toBe(true);
        expect(body.auto_resolve_attempted).toBe(true);
        expect(body.auto_resolve_succeeded).toBe(true);
        expect(body.auto_resolve_status).toBe("resolved");

        expect(mockTryAutoResolve).toHaveBeenCalledOnce();
        expect(mockTryAutoResolve).toHaveBeenCalledWith(
            "inst-1",
            expect.objectContaining({
                active_question_id: "q-1",
                student_id: "student-1",
            })
        );
    });

    // -------------------------------------------------------------------------
    // C) Timed question, all answers received before timer expires → auto-resolve
    // -------------------------------------------------------------------------
    it("C) timed question — auto-resolve fires before timer expiry when quorum met", async () => {
        mockTryAutoResolve.mockResolvedValue({ auto_resolve_status: "resolved" });

        const futureEndsAt = new Date(Date.now() + 20000).toISOString(); // 20s in future
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ question_ends_at: futureEndsAt }) })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: {
                ...makeInstance({ question_ends_at: futureEndsAt }),
                received_answer_count: 2,
                required_answer_count: 2,
                ready_to_resolve: false,
            }})
            .mockResolvedValueOnce({}); // setReadyToResolve

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);

        const body = JSON.parse(res.body);
        expect(body.ready_to_resolve).toBe(true);
        expect(body.auto_resolve_status).toBe("resolved");
        expect(mockTryAutoResolve).toHaveBeenCalledOnce();
    });

    // -------------------------------------------------------------------------
    // D) Untimed question → auto-resolve immediately when quorum reached
    // -------------------------------------------------------------------------
    it("D) untimed question — auto-resolve immediately when quorum reached", async () => {
        mockTryAutoResolve.mockResolvedValue({ auto_resolve_status: "resolved" });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ question_ends_at: undefined }) })
            .mockResolvedValueOnce({ Item: makeQuestion({ time_limit_seconds: undefined }) })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: {
                ...makeInstance({ question_ends_at: undefined }),
                received_answer_count: 1,
                required_answer_count: 1,
                ready_to_resolve: false,
            }})
            .mockResolvedValueOnce({}); // setReadyToResolve

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);

        const body = JSON.parse(res.body);
        expect(body.quorum_reached).toBe(true);
        expect(body.auto_resolve_attempted).toBe(true);
        expect(body.auto_resolve_status).toBe("resolved");
        expect(mockTryAutoResolve).toHaveBeenCalledOnce();
    });

    // -------------------------------------------------------------------------
    // E) Race condition: two concurrent last-answers; second sees "already_resolved"
    // -------------------------------------------------------------------------
    it("E) race condition — already_resolved is treated as success, not an error", async () => {
        // Simulate the scenario where another concurrent request resolved first.
        // tryAutoResolveBossQuestion returns already_resolved (ConditionalCheckFailedException swallowed internally).
        mockTryAutoResolve.mockResolvedValue({ auto_resolve_status: "already_resolved" });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: {
                ...makeInstance(),
                received_answer_count: 3,
                required_answer_count: 3,
                ready_to_resolve: true, // already set by concurrent request
            }});
        // No setReadyToResolve call because ready_to_resolve was already true on updatedInstance

        const res = await submitAnswerHandler(makeEvent());
        // Submit response must still be 200 — the race is a safe no-op
        expect(res.statusCode).toBe(200);

        const body = JSON.parse(res.body);
        expect(body.ready_to_resolve).toBe(true);
        expect(body.auto_resolve_attempted).toBe(true);
        expect(body.auto_resolve_succeeded).toBe(false);
        expect(body.auto_resolve_status).toBe("already_resolved");
    });

    // -------------------------------------------------------------------------
    // E2) Race condition: instance not yet ready_to_resolve from DynamoDB (pre-flight skips)
    // -------------------------------------------------------------------------
    it("E2) race condition — skipped_not_ready maps to not_needed in response", async () => {
        mockTryAutoResolve.mockResolvedValue({ auto_resolve_status: "skipped_not_ready" });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: {
                ...makeInstance(),
                received_answer_count: 3,
                required_answer_count: 3,
                ready_to_resolve: true,
            }});

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);

        const body = JSON.parse(res.body);
        // skipped_not_ready → front-end-visible status is "not_needed"
        expect(body.auto_resolve_status).toBe("not_needed");
        expect(body.auto_resolve_succeeded).toBe(false);
    });

    // -------------------------------------------------------------------------
    // F) Unexpected auto-resolve failure → submit still returns 200
    // -------------------------------------------------------------------------
    it("F) unexpected auto-resolve failure — submit succeeds, status is failed", async () => {
        mockTryAutoResolve.mockResolvedValue({ auto_resolve_status: "failed", error: "DynamoDB timeout" });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: {
                ...makeInstance(),
                received_answer_count: 3,
                required_answer_count: 3,
                ready_to_resolve: true,
            }});

        const res = await submitAnswerHandler(makeEvent());
        // Answer submission persisted — must not fail due to auto-resolve failure
        expect(res.statusCode).toBe(200);

        const body = JSON.parse(res.body);
        expect(body.auto_resolve_status).toBe("failed");
        expect(body.auto_resolve_succeeded).toBe(false);
        expect(body.is_correct).toBeDefined(); // core submit data still present
    });

    // -------------------------------------------------------------------------
    // G) RANDOMIZED_PER_GUILD — auto-resolve fires on per-guild quorum and does not crash
    // -------------------------------------------------------------------------
    it("G) RANDOMIZED_PER_GUILD — auto-resolve attempted when guild quorum met", async () => {
        mockTryAutoResolve.mockResolvedValue({ auto_resolve_status: "resolved" });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ mode_type: "RANDOMIZED_PER_GUILD" }) })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant({ guild_id: "guild-1" }) })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: {
                ...makeInstance({ mode_type: "RANDOMIZED_PER_GUILD" }),
                per_guild_required_answer_count: { "guild-1": 2 },
                per_guild_received_answer_count: { "guild-1": 2 },
                ready_to_resolve: false,
            }})
            .mockResolvedValueOnce({}); // setReadyToResolve

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);

        const body = JSON.parse(res.body);
        expect(body.ready_to_resolve).toBe(true);
        expect(body.auto_resolve_status).toBe("resolved");
        // tryAutoResolveBossQuestion is called — per-guild readiness routes through the shared path
        // TODO: fully support auto-resolve for independent per-guild question readiness
        //       once RANDOMIZED_PER_GUILD active-question tracking is complete
        expect(mockTryAutoResolve).toHaveBeenCalledOnce();
    });

    // -------------------------------------------------------------------------
    // G2) RANDOMIZED_PER_GUILD — no crash when guild quorum not yet met
    // -------------------------------------------------------------------------
    it("G2) RANDOMIZED_PER_GUILD — does not crash when guild quorum not yet met", async () => {
        mockTryAutoResolve.mockReset();

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ mode_type: "RANDOMIZED_PER_GUILD" }) })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Item: makeParticipant({ guild_id: "guild-1" }) })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: {
                ...makeInstance({ mode_type: "RANDOMIZED_PER_GUILD" }),
                per_guild_required_answer_count: { "guild-1": 3 },
                per_guild_received_answer_count: { "guild-1": 1 }, // not yet met
                ready_to_resolve: false,
            }});

        const res = await submitAnswerHandler(makeEvent());
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).auto_resolve_status).toBe("not_needed");
        expect(mockTryAutoResolve).not.toHaveBeenCalled();
    });
});

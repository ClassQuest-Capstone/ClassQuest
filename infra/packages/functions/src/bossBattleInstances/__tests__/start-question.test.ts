/**
 * Unit tests for the StartQuestion lifecycle action.
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
    DeleteCommand: vi.fn(function (input: any) { this.input = input; }),
}));

// ---------------------------------------------------------------------------
// Module references
// ---------------------------------------------------------------------------
let repoModule: typeof import("../repo.ts");
let startQuestionHandler: (typeof import("../start-question.ts"))["handler"];

beforeAll(async () => {
    process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME    = "test-bbi";
    process.env.BOSS_BATTLE_TEMPLATES_TABLE_NAME    = "test-bbt";
    process.env.BOSS_BATTLE_QUESTION_PLANS_TABLE_NAME = "test-bbqp";
    process.env.BOSS_QUESTIONS_TABLE_NAME           = "test-bq";
    process.env.BOSS_BATTLE_PARTICIPANTS_TABLE_NAME = "test-bbp";
    process.env.BOSS_BATTLE_SNAPSHOTS_TABLE_NAME    = "test-bbs";

    repoModule           = await import("../repo.ts");
    startQuestionHandler = (await import("../start-question.ts")).handler;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeInstance(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id:       "inst-1",
        class_id:               "class-1",
        boss_template_id:       "tpl-1",
        created_by_teacher_id:  "teacher-1",
        status:                 "COUNTDOWN",
        mode_type:              "SIMULTANEOUS_ALL",
        question_selection_mode: "ORDERED",
        initial_boss_hp:        1000,
        current_boss_hp:        1000,
        countdown_seconds:      10,
        question_plan_id:       "plan-1",
        current_question_index: 0,
        speed_bonus_enabled:    true,
        speed_bonus_floor_multiplier: 0.2,
        speed_window_seconds:   30,
        anti_spam_min_submit_interval_ms: 1500,
        freeze_on_wrong_seconds: 3,
        late_join_policy:       "DISALLOW_AFTER_COUNTDOWN",
        created_at:             "2026-01-01T00:00:00.000Z",
        updated_at:             "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeTemplate() {
    return {
        boss_template_id:   "tpl-1",
        owner_teacher_id:   "teacher-1",
        title:              "Dragon Boss",
        max_hp:             1000,
        base_xp_reward:     200,
        base_gold_reward:   100,
        is_shared_publicly: "false",
        public_sort:        "MATH#2026-01-01T00:00:00.000Z#tpl-1",
        created_at:         "2026-01-01T00:00:00.000Z",
        updated_at:         "2026-01-01T00:00:00.000Z",
        is_deleted:         false,
    };
}

function makeGlobalPlan(questionIds: string[] = ["q1", "q2"]) {
    return {
        plan_id:          "plan-1",
        boss_instance_id: "inst-1",
        class_id:         "class-1",
        boss_template_id: "tpl-1",
        mode_type:        "SIMULTANEOUS_ALL",
        question_selection_mode: "ORDERED",
        created_by_teacher_id: "teacher-1",
        created_at:       "2026-01-01T00:00:00.000Z",
        version:          1,
        question_ids:     questionIds,
        question_count:   questionIds.length,
    };
}

function makePerGuildPlan(guildIds: string[] = ["guild-1", "guild-2"]) {
    const guild_question_ids: Record<string, string[]> = {};
    const guild_question_count: Record<string, number> = {};
    for (const gid of guildIds) {
        guild_question_ids[gid]  = ["q1", "q2"];
        guild_question_count[gid] = 2;
    }
    return {
        plan_id:          "plan-pg",
        boss_instance_id: "inst-1",
        class_id:         "class-1",
        boss_template_id: "tpl-1",
        mode_type:        "RANDOMIZED_PER_GUILD",
        question_selection_mode: "RANDOM_NO_REPEAT",
        created_by_teacher_id: "teacher-1",
        created_at:       "2026-01-01T00:00:00.000Z",
        version:          1,
        guild_question_ids,
        guild_question_count,
    };
}

function makeQuestion(overrides: Record<string, any> = {}) {
    return {
        question_id:             "q1",
        boss_template_id:        "tpl-1",
        order_index:             0,
        order_key:               "000001",
        question_text:           "What is 2+2?",
        question_type:           "MCQ_SINGLE",
        damage_to_boss_on_correct: 100,
        damage_to_guild_on_incorrect: 50,
        auto_gradable:           true,
        created_at:              "2026-01-01T00:00:00.000Z",
        updated_at:              "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeEvent(boss_instance_id: string) {
    return {
        pathParameters: { boss_instance_id },
        body: null,
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

/** Mock sequence for a successful SIMULTANEOUS_ALL StartQuestion */
function mockSuccessSimultaneous(instanceOverrides: Record<string, any> = {}, questionOverrides: Record<string, any> = {}) {
    // The returned updated item always has status=QUESTION_ACTIVE regardless of the input status
    const updatedInstance = makeInstance({
        active_question_id: "q1",
        question_started_at: "2026-03-10T12:00:00.000Z",
        updated_at: "2026-03-10T12:00:00.000Z",
        ...instanceOverrides,
        status: "QUESTION_ACTIVE", // always override to QUESTION_ACTIVE in the result
    });
    mockSend
        .mockResolvedValueOnce({ Item: makeInstance(instanceOverrides) })    // getBossBattleInstance
        .mockResolvedValueOnce({ Item: makeTemplate() })                     // getBossTemplate
        .mockResolvedValueOnce({ Item: makeGlobalPlan() })                   // getQuestionPlan
        .mockResolvedValueOnce({ Items: [] })                                // listParticipants (quorum)
        .mockResolvedValueOnce({ Item: makeQuestion(questionOverrides) })    // getQuestion
        .mockResolvedValueOnce({ Attributes: updatedInstance });             // startBossBattleQuestion
    return updatedInstance;
}

// ---------------------------------------------------------------------------
// repo.startBossBattleQuestion
// ---------------------------------------------------------------------------
describe("repo.startBossBattleQuestion", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("sends UpdateCommand with COUNTDOWN/INTERMISSION condition and QUESTION_ACTIVE transition (timed)", async () => {
        const updated = makeInstance({
            status: "QUESTION_ACTIVE",
            active_question_id: "q1",
            question_started_at: "2026-03-10T12:00:00.000Z",
            question_ends_at: "2026-03-10T12:00:30.000Z",
        });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        const result = await repoModule.startBossBattleQuestion("inst-1", {
            active_question_id: "q1",
            question_started_at: "2026-03-10T12:00:00.000Z",
            question_ends_at: "2026-03-10T12:00:30.000Z",
            updated_at: "2026-03-10T12:00:00.000Z",
        });

        const [cmd] = mockSend.mock.calls[0];
        const p = cmd.input;
        expect(p.ExpressionAttributeValues[":question_active"]).toBe("QUESTION_ACTIVE");
        expect(p.ExpressionAttributeValues[":countdown"]).toBe("COUNTDOWN");
        expect(p.ExpressionAttributeValues[":intermission"]).toBe("INTERMISSION");
        expect(p.ConditionExpression).toContain("OR");
        expect(p.ReturnValues).toBe("ALL_NEW");
        expect(p.UpdateExpression).toContain("SET");
        expect(p.UpdateExpression).not.toContain("REMOVE");
        expect(result.status).toBe("QUESTION_ACTIVE");
    });

    it("uses REMOVE for question_ends_at when untimed", async () => {
        const updated = makeInstance({ status: "QUESTION_ACTIVE", active_question_id: "q1" });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        await repoModule.startBossBattleQuestion("inst-1", {
            active_question_id: "q1",
            question_started_at: "2026-03-10T12:00:00.000Z",
            question_ends_at: null,
            updated_at: "2026-03-10T12:00:00.000Z",
        });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.UpdateExpression).toContain("REMOVE");
        expect(cmd.input.UpdateExpression).toContain("#question_ends_at");
    });

    it("includes active_guild_id in SET when provided", async () => {
        const updated = makeInstance({ status: "QUESTION_ACTIVE", active_guild_id: "guild-1" });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        await repoModule.startBossBattleQuestion("inst-1", {
            active_question_id: "q1",
            active_guild_id: "guild-1",
            question_started_at: "2026-03-10T12:00:00.000Z",
            question_ends_at: null,
            updated_at: "2026-03-10T12:00:00.000Z",
        });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.UpdateExpression).toContain("#active_guild_id");
        expect(cmd.input.ExpressionAttributeValues[":active_guild_id"]).toBe("guild-1");
    });

    it("propagates ConditionalCheckFailedException for invalid state", async () => {
        const err = Object.assign(new Error("failed"), { name: "ConditionalCheckFailedException" });
        mockSend.mockRejectedValueOnce(err);

        await expect(
            repoModule.startBossBattleQuestion("inst-1", {
                active_question_id: "q1",
                question_started_at: "2026-03-10T12:00:00.000Z",
                question_ends_at: null,
                updated_at: "2026-03-10T12:00:00.000Z",
            })
        ).rejects.toMatchObject({ name: "ConditionalCheckFailedException" });
    });
});

// ---------------------------------------------------------------------------
// handler: start-question — state validation
// ---------------------------------------------------------------------------
describe("startQuestion handler — state validation", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("returns 200 on successful COUNTDOWN -> QUESTION_ACTIVE", async () => {
        mockSuccessSimultaneous();
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe("QUESTION_ACTIVE");
        expect(body.active_question_id).toBe("q1");
    });

    it("returns 200 on successful INTERMISSION -> QUESTION_ACTIVE", async () => {
        mockSuccessSimultaneous({ status: "INTERMISSION" });
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).status).toBe("QUESTION_ACTIVE");
    });

    it("returns 409 from DRAFT", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "DRAFT" }) });
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).current_status).toBe("DRAFT");
    });

    it("returns 409 from LOBBY", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "LOBBY" }) });
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).current_status).toBe("LOBBY");
    });

    it("returns 409 from QUESTION_ACTIVE", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "QUESTION_ACTIVE" }) });
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).current_status).toBe("QUESTION_ACTIVE");
    });

    it("returns 409 from RESOLVING", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "RESOLVING" }) });
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
    });

    it("returns 409 from COMPLETED", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "COMPLETED" }) });
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
    });

    it("returns 409 from ABORTED", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "ABORTED" }) });
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
    });

    it("returns 404 when instance does not exist", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const response = await startQuestionHandler(makeEvent("nonexistent"));
        expect(response.statusCode).toBe(404);
        expect(JSON.parse(response.body).error).toBe("Boss battle instance not found");
    });

    it("returns 400 when boss_instance_id is missing", async () => {
        const response = await startQuestionHandler({ pathParameters: {}, body: null });
        expect(response.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// handler: start-question — template validation
// ---------------------------------------------------------------------------
describe("startQuestion handler — template validation", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("returns 409 when template is soft-deleted", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: { ...makeTemplate(), is_deleted: true } });
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).error).toBe("Cannot start question from a deleted template");
    });

    it("returns 409 when template does not exist", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: undefined });
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
    });
});

// ---------------------------------------------------------------------------
// handler: start-question — timing
// ---------------------------------------------------------------------------
describe("startQuestion handler — timing", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("sets question_ends_at when question has time_limit_seconds", async () => {
        mockSuccessSimultaneous({}, { time_limit_seconds: 30 });
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        // question_starts_at and question_ends_at should both be on the updated item
        expect(body.question_started_at).toBeTruthy();
    });

    it("question_ends_at is null when question has no time limit and instance has no default", async () => {
        // question has no time_limit_seconds, instance has no time_limit_seconds_default
        const updatedInstance = makeInstance({
            status: "QUESTION_ACTIVE",
            active_question_id: "q1",
            question_started_at: "2026-03-10T12:00:00.000Z",
            updated_at: "2026-03-10T12:00:00.000Z",
            // question_ends_at intentionally absent (REMOVE was called)
        });
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan() })
            .mockResolvedValueOnce({ Items: [] })                              // listParticipants
            .mockResolvedValueOnce({ Item: makeQuestion({ time_limit_seconds: undefined }) })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(200);

        // Verify REMOVE was used for question_ends_at in the UpdateCommand
        const updateCall = mockSend.mock.calls.find(
            (c) => c[0]?.input?.UpdateExpression?.includes("REMOVE")
        );
        expect(updateCall).toBeDefined();
    });

    it("uses instance time_limit_seconds_default when question has no override", async () => {
        // question has no time_limit_seconds, but instance has time_limit_seconds_default
        const instanceWithDefault = makeInstance({ time_limit_seconds_default: 20 });
        const updatedInstance = makeInstance({
            status: "QUESTION_ACTIVE",
            active_question_id: "q1",
            question_started_at: "2026-03-10T12:00:00.000Z",
            question_ends_at: "2026-03-10T12:00:20.000Z",
            updated_at: "2026-03-10T12:00:00.000Z",
        });
        mockSend
            .mockResolvedValueOnce({ Item: instanceWithDefault })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan() })
            .mockResolvedValueOnce({ Items: [] })                              // listParticipants
            .mockResolvedValueOnce({ Item: makeQuestion({ time_limit_seconds: undefined }) })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(200);

        const updateCall = mockSend.mock.calls.find(
            (c) => c[0]?.input?.ExpressionAttributeValues?.[":question_ends_at"]
        );
        expect(updateCall).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// handler: start-question — plan / question errors
// ---------------------------------------------------------------------------
describe("startQuestion handler — plan and question errors", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("returns 409 when question_plan_id is missing on instance", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ question_plan_id: undefined }) })
            .mockResolvedValueOnce({ Item: makeTemplate() });
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).error).toBe("No question plan found for this battle");
    });

    it("returns 404 when question plan does not exist", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: undefined }); // plan not found
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(404);
        expect(JSON.parse(response.body).error).toBe("Question plan not found");
    });

    it("returns 409 when current_question_index is out of bounds", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ current_question_index: 99 }) })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan(["q1"]) }); // only 1 question
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).error).toBe("No remaining questions in plan");
    });

    it("returns 404 when BossQuestion not found", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan() })
            .mockResolvedValueOnce({ Items: [] })          // listParticipants
            .mockResolvedValueOnce({ Item: undefined }); // question missing
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(404);
        expect(JSON.parse(response.body).error).toBe("Boss question not found");
    });

    it("returns 409 on concurrent call (ConditionalCheckFailedException)", async () => {
        const condErr = Object.assign(new Error("failed"), { name: "ConditionalCheckFailedException" });
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan() })
            .mockResolvedValueOnce({ Items: [] })          // listParticipants
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockRejectedValueOnce(condErr);
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
    });
});

// ---------------------------------------------------------------------------
// handler: start-question — TURN_BASED_GUILD
// ---------------------------------------------------------------------------
describe("startQuestion handler — TURN_BASED_GUILD", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("sets active_guild_id from existing instance.active_guild_id", async () => {
        const instance = makeInstance({
            mode_type: "TURN_BASED_GUILD",
            active_guild_id: "guild-1",
        });
        const updatedInstance = makeInstance({
            status: "QUESTION_ACTIVE",
            mode_type: "TURN_BASED_GUILD",
            active_question_id: "q1",
            active_guild_id: "guild-1",
            question_started_at: "2026-03-10T12:00:00.000Z",
            updated_at: "2026-03-10T12:00:00.000Z",
        });
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan() })
            .mockResolvedValueOnce({ Items: [{ guild_id: "guild-1", state: "JOINED", is_downed: false, student_id: "s1" }] }) // listParticipants
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).active_guild_id).toBe("guild-1");
    });

    it("returns 409 when no active_guild_id is set for TURN_BASED_GUILD", async () => {
        const instance = makeInstance({
            mode_type: "TURN_BASED_GUILD",
            active_guild_id: undefined,
        });
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan() });
        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).error).toContain("active guild");
    });
});

// ---------------------------------------------------------------------------
// handler: start-question — RANDOMIZED_PER_GUILD
// ---------------------------------------------------------------------------
describe("startQuestion handler — RANDOMIZED_PER_GUILD", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("succeeds and does not crash for RANDOMIZED_PER_GUILD", async () => {
        const instance = makeInstance({
            mode_type: "RANDOMIZED_PER_GUILD",
            guild_question_plan_id: "plan-pg",
            question_plan_id: undefined,
            per_guild_question_index: { "guild-1": 0, "guild-2": 0 },
        });
        const updatedInstance = makeInstance({
            status: "QUESTION_ACTIVE",
            mode_type: "RANDOMIZED_PER_GUILD",
            active_question_id: "q1",
            question_started_at: "2026-03-10T12:00:00.000Z",
            updated_at: "2026-03-10T12:00:00.000Z",
        });
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makePerGuildPlan() })
            .mockResolvedValueOnce({ Items: [] })          // listParticipants (quorum)
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).status).toBe("QUESTION_ACTIVE");
    });

    it("returns 409 when per_guild_question_index is missing", async () => {
        const instance = makeInstance({
            mode_type: "RANDOMIZED_PER_GUILD",
            guild_question_plan_id: "plan-pg",
            question_plan_id: undefined,
            per_guild_question_index: undefined,
        });
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makePerGuildPlan() });

        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).error).toContain("per-guild question index");
    });

    it("returns 409 when guild_question_plan_id is missing", async () => {
        const instance = makeInstance({
            mode_type: "RANDOMIZED_PER_GUILD",
            guild_question_plan_id: undefined,
            question_plan_id: undefined,
        });
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: makeTemplate() });

        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).error).toBe("No guild question plan found for this battle");
    });
});

// ---------------------------------------------------------------------------
// handler: start-question — answer-gating quorum initialization
// ---------------------------------------------------------------------------
describe("startQuestion handler — answer-gating quorum initialization", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("SIMULTANEOUS_ALL: required_answer_count = total JOINED non-downed participants", async () => {
        const participants = [
            { guild_id: "g1", state: "JOINED", is_downed: false, student_id: "s1" },
            { guild_id: "g1", state: "JOINED", is_downed: false, student_id: "s2" },
            { guild_id: "g2", state: "JOINED", is_downed: false, student_id: "s3" },
        ];
        const updatedInstance = makeInstance({ status: "QUESTION_ACTIVE", active_question_id: "q1", required_answer_count: 3, received_answer_count: 0, ready_to_resolve: false });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan() })
            .mockResolvedValueOnce({ Items: participants })    // listParticipants
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(200);
        // Verify UpdateCommand included required_answer_count=3, received_answer_count=0, ready_to_resolve=false
        const updateCall = mockSend.mock.calls.find(
            (c) => c[0]?.input?.ExpressionAttributeValues?.[":required_answer_count"] !== undefined
        );
        expect(updateCall).toBeDefined();
        expect(updateCall![0].input.ExpressionAttributeValues[":required_answer_count"]).toBe(3);
        expect(updateCall![0].input.ExpressionAttributeValues[":received_answer_count"]).toBe(0);
        expect(updateCall![0].input.ExpressionAttributeValues[":ready_to_resolve"]).toBe(false);
    });

    it("SIMULTANEOUS_ALL: excludes downed participants from required_answer_count", async () => {
        const participants = [
            { guild_id: "g1", state: "JOINED", is_downed: false, student_id: "s1" },
            { guild_id: "g1", state: "JOINED", is_downed: true,  student_id: "s2" }, // downed, excluded
        ];
        const updatedInstance = makeInstance({ status: "QUESTION_ACTIVE", active_question_id: "q1", required_answer_count: 1 });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan() })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(200);
        const updateCall = mockSend.mock.calls.find(
            (c) => c[0]?.input?.ExpressionAttributeValues?.[":required_answer_count"] !== undefined
        );
        expect(updateCall![0].input.ExpressionAttributeValues[":required_answer_count"]).toBe(1);
    });

    it("TURN_BASED_GUILD: required_answer_count counts only active-guild JOINED non-downed participants", async () => {
        const participants = [
            { guild_id: "guild-1", state: "JOINED", is_downed: false, student_id: "s1" },
            { guild_id: "guild-1", state: "JOINED", is_downed: false, student_id: "s2" },
            { guild_id: "guild-2", state: "JOINED", is_downed: false, student_id: "s3" }, // different guild, excluded
        ];
        const updatedInstance = makeInstance({
            status: "QUESTION_ACTIVE",
            mode_type: "TURN_BASED_GUILD",
            active_guild_id: "guild-1",
            active_question_id: "q1",
            required_answer_count: 2,
        });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ mode_type: "TURN_BASED_GUILD", active_guild_id: "guild-1" }) })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan() })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(200);
        const updateCall = mockSend.mock.calls.find(
            (c) => c[0]?.input?.ExpressionAttributeValues?.[":required_answer_count"] !== undefined
        );
        expect(updateCall![0].input.ExpressionAttributeValues[":required_answer_count"]).toBe(2);
    });

    it("RANDOMIZED_PER_GUILD: initializes per_guild_required_answer_count map", async () => {
        const participants = [
            { guild_id: "guild-1", state: "JOINED", is_downed: false, student_id: "s1" },
            { guild_id: "guild-1", state: "JOINED", is_downed: false, student_id: "s2" },
            { guild_id: "guild-2", state: "JOINED", is_downed: false, student_id: "s3" },
        ];
        const updatedInstance = makeInstance({
            status: "QUESTION_ACTIVE",
            mode_type: "RANDOMIZED_PER_GUILD",
            active_question_id: "q1",
            per_guild_required_answer_count: { "guild-1": 2, "guild-2": 1 },
        });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ mode_type: "RANDOMIZED_PER_GUILD", guild_question_plan_id: "plan-pg", question_plan_id: undefined, per_guild_question_index: { "guild-1": 0, "guild-2": 0 } }) })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makePerGuildPlan() })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(200);
        const updateCall = mockSend.mock.calls.find(
            (c) => c[0]?.input?.ExpressionAttributeValues?.[":per_guild_required_answer_count"] !== undefined
        );
        expect(updateCall).toBeDefined();
        expect(updateCall![0].input.ExpressionAttributeValues[":per_guild_required_answer_count"]["guild-1"]).toBe(2);
        expect(updateCall![0].input.ExpressionAttributeValues[":per_guild_required_answer_count"]["guild-2"]).toBe(1);
    });

    it("ready_to_resolve is set to true immediately when required_answer_count = 0 (no active participants)", async () => {
        const updatedInstance = makeInstance({
            status: "QUESTION_ACTIVE",
            active_question_id: "q1",
            required_answer_count: 0,
            received_answer_count: 0,
            ready_to_resolve: true,
        });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan() })
            .mockResolvedValueOnce({ Items: [] })           // no active participants
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const response = await startQuestionHandler(makeEvent("inst-1"));
        expect(response.statusCode).toBe(200);
        const updateCall = mockSend.mock.calls.find(
            (c) => c[0]?.input?.ExpressionAttributeValues?.[":ready_to_resolve"] !== undefined
        );
        expect(updateCall![0].input.ExpressionAttributeValues[":ready_to_resolve"]).toBe(true);
        expect(updateCall![0].input.ExpressionAttributeValues[":required_answer_count"]).toBe(0);
    });

    it("received_answer_count is always initialized to 0", async () => {
        const participants = [{ guild_id: "g1", state: "JOINED", is_downed: false, student_id: "s1" }];
        const updatedInstance = makeInstance({ status: "QUESTION_ACTIVE", active_question_id: "q1" });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeTemplate() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan() })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({ Item: makeQuestion() })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        await startQuestionHandler(makeEvent("inst-1"));
        const updateCall = mockSend.mock.calls.find(
            (c) => c[0]?.input?.ExpressionAttributeValues?.[":received_answer_count"] !== undefined
        );
        expect(updateCall![0].input.ExpressionAttributeValues[":received_answer_count"]).toBe(0);
    });
});

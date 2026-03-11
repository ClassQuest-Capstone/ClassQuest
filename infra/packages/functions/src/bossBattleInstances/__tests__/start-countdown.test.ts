/**
 * Unit tests for the StartCountdown lifecycle action.
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DynamoDB so no real AWS calls are made.
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
// Module references — populated in beforeAll so env vars are set first.
// ---------------------------------------------------------------------------
let repoModule: typeof import("../repo.ts");
let countdownHandler: (typeof import("../start-countdown.ts"))["handler"];

beforeAll(async () => {
    process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME    = "test-bbi";
    process.env.BOSS_BATTLE_TEMPLATES_TABLE_NAME    = "test-bbt";
    process.env.BOSS_BATTLE_PARTICIPANTS_TABLE_NAME = "test-bbp";
    process.env.BOSS_BATTLE_SNAPSHOTS_TABLE_NAME    = "test-bbs";
    process.env.BOSS_BATTLE_QUESTION_PLANS_TABLE_NAME = "test-bbqp";
    process.env.BOSS_QUESTIONS_TABLE_NAME           = "test-bq";

    repoModule       = await import("../repo.ts");
    countdownHandler = (await import("../start-countdown.ts")).handler;
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
        status:                 "LOBBY",
        mode_type:              "SIMULTANEOUS_ALL",
        question_selection_mode: "ORDERED",
        initial_boss_hp:        1000,
        current_boss_hp:        1000,
        countdown_seconds:      10,
        speed_bonus_enabled:    true,
        speed_bonus_floor_multiplier: 0.2,
        speed_window_seconds:   30,
        anti_spam_min_submit_interval_ms: 1500,
        freeze_on_wrong_seconds: 3,
        late_join_policy:       "DISALLOW_AFTER_COUNTDOWN",
        current_question_index: 0,
        created_at:             "2026-01-01T00:00:00.000Z",
        updated_at:             "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeTemplate(overrides: Record<string, any> = {}) {
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
        ...overrides,
    };
}

function makeParticipant(studentId: string, guildId = "guild-1") {
    return {
        boss_instance_id: "inst-1",
        student_id: studentId,
        class_id: "class-1",
        guild_id: guildId,
        state: "JOINED",
        joined_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        is_downed: false,
        gsi2_sk: `inst-1#${studentId}`,
    };
}

function makeSnapshot(snapshotId: string) {
    return {
        snapshot_id: snapshotId,
        boss_instance_id: "inst-1",
        class_id: "class-1",
        created_by_teacher_id: "teacher-1",
        created_at: "2026-03-10T12:00:00.000Z",
        joined_students: [{ student_id: "s1", guild_id: "guild-1" }],
        joined_count: 1,
        guild_counts: { "guild-1": 1 },
        version: 1,
    };
}

function makeQuestion(questionId: string, orderKey: string) {
    return {
        question_id: questionId,
        boss_template_id: "tpl-1",
        order_key: orderKey,
        text: "What is 2+2?",
        answer: "4",
    };
}

/** Base event — auth is disabled (TODO) so no auth fields needed. */
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

// ---------------------------------------------------------------------------
// repo.startBossBattleCountdown
// ---------------------------------------------------------------------------
describe("repo.startBossBattleCountdown", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("sends UpdateCommand with LOBBY condition and COUNTDOWN transition", async () => {
        const updatedItem = makeInstance({
            status: "COUNTDOWN",
            countdown_end_at: "2026-03-10T12:00:10.000Z",
            updated_at: "2026-03-10T12:00:00.000Z",
        });
        mockSend.mockResolvedValueOnce({ Attributes: updatedItem });

        const result = await repoModule.startBossBattleCountdown(
            "inst-1",
            "2026-03-10T12:00:10.000Z",
            "2026-03-10T12:00:00.000Z"
        );

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;

        expect(params.ExpressionAttributeValues[":lobby"]).toBe("LOBBY");
        expect(params.ExpressionAttributeValues[":countdown"]).toBe("COUNTDOWN");
        expect(params.ConditionExpression).toContain("#status = :lobby");
        expect(params.ConditionExpression).toContain("attribute_exists(boss_instance_id)");
        expect(params.ReturnValues).toBe("ALL_NEW");
        expect(result.status).toBe("COUNTDOWN");
        expect(result.countdown_end_at).toBe("2026-03-10T12:00:10.000Z");
    });

    it("propagates ConditionalCheckFailedException when status is not LOBBY", async () => {
        const err = new Error("Conditional check failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        await expect(
            repoModule.startBossBattleCountdown("inst-1", "2026-03-10T12:00:10.000Z", "2026-03-10T12:00:00.000Z")
        ).rejects.toMatchObject({ name: "ConditionalCheckFailedException" });
    });
});

// ---------------------------------------------------------------------------
// handler: start-countdown
// ---------------------------------------------------------------------------
describe("startCountdown handler", () => {
    beforeEach(() => { mockSend.mockReset(); });

    /**
     * Successful LOBBY -> COUNTDOWN transition for SIMULTANEOUS_ALL mode.
     *
     * DynamoDB call order inside the handler:
     *  1. GetCommand  — getBossBattleInstance
     *  2. GetCommand  — getBossTemplate
     *  3. QueryCommand — listParticipants (state filter applied in-memory for mock)
     *  4. GetCommand  — createParticipantsSnapshot: load instance
     *  5. QueryCommand — createParticipantsSnapshot: query participants
     *  6. PutCommand  — createParticipantsSnapshot: write snapshot
     *  7. UpdateCommand — createParticipantsSnapshot: update instance.participants_snapshot_id
     *  8. GetCommand  — createQuestionPlanForInstance: load instance
     *  9. QueryCommand — createQuestionPlanForInstance: load boss questions
     * 10. PutCommand  — createQuestionPlanForInstance: write plan
     * 11. UpdateCommand — createQuestionPlanForInstance: update instance question_plan_id
     * 12. UpdateCommand — startBossBattleCountdown: LOBBY -> COUNTDOWN
     */
    it("returns 200 with COUNTDOWN instance on successful transition", async () => {
        const instance       = makeInstance({ status: "LOBBY" });
        const template       = makeTemplate();
        const participants   = [makeParticipant("s1")];
        const snapshot       = makeSnapshot("snap-1");
        const questions      = [makeQuestion("q1", "0001"), makeQuestion("q2", "0002")];
        const updatedInstance = makeInstance({
            status:                  "COUNTDOWN",
            participants_snapshot_id: "snap-1",
            question_plan_id:        "plan-1",
            current_question_index:  0,
            countdown_end_at:        "2026-03-10T12:00:10.000Z",
            updated_at:              "2026-03-10T12:00:00.000Z",
        });

        mockSend
            .mockResolvedValueOnce({ Item: instance })          // 1. getBossBattleInstance
            .mockResolvedValueOnce({ Item: template })          // 2. getBossTemplate
            .mockResolvedValueOnce({ Items: participants })     // 3. listParticipants
            .mockResolvedValueOnce({ Item: instance })          // 4. snapshot: load instance
            .mockResolvedValueOnce({ Items: participants })     // 5. snapshot: query participants
            .mockResolvedValueOnce({})                          // 6. snapshot: put snapshot
            .mockResolvedValueOnce({})                          // 7. snapshot: update instance
            .mockResolvedValueOnce({ Item: { ...instance, participants_snapshot_id: "snap-1" } }) // 8. plan: load instance
            .mockResolvedValueOnce({ Items: questions })        // 9. plan: load questions
            .mockResolvedValueOnce({})                          // 10. plan: put plan
            .mockResolvedValueOnce({})                          // 11. plan: update instance
            .mockResolvedValueOnce({ Attributes: updatedInstance }); // 12. countdown update

        const response = await countdownHandler(makeEvent("inst-1"));

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe("COUNTDOWN");
        expect(body.participants_snapshot_id).toBe("snap-1");
        expect(body.question_plan_id).toBe("plan-1");
        expect(body.current_question_index).toBe(0);
        expect(body.countdown_end_at).toBeTruthy();
        expect(body.updated_at).toBeTruthy();
    });

    it("returns 200 and sets per_guild_question_index for RANDOMIZED_PER_GUILD", async () => {
        const instance = makeInstance({ status: "LOBBY", mode_type: "RANDOMIZED_PER_GUILD" });
        const template = makeTemplate();
        const participants = [
            makeParticipant("s1", "guild-1"),
            makeParticipant("s2", "guild-2"),
        ];
        const snapshotWithGuilds = {
            ...makeSnapshot("snap-2"),
            joined_students: [
                { student_id: "s1", guild_id: "guild-1" },
                { student_id: "s2", guild_id: "guild-2" },
            ],
            guild_counts: { "guild-1": 1, "guild-2": 1 },
        };
        const questions = [makeQuestion("q1", "0001")];
        const updatedInstance = makeInstance({
            status: "COUNTDOWN",
            mode_type: "RANDOMIZED_PER_GUILD",
            participants_snapshot_id: "snap-2",
            question_plan_id: "plan-2",
            guild_question_plan_id: "plan-2",
            current_question_index: 0,
            per_guild_question_index: { "guild-1": 0, "guild-2": 0 },
            countdown_end_at: "2026-03-10T12:00:10.000Z",
            updated_at: "2026-03-10T12:00:00.000Z",
        });

        const instanceWithSnap = { ...instance, participants_snapshot_id: "snap-2" };

        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: template })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: instanceWithSnap })
            .mockResolvedValueOnce({ Items: questions })
            .mockResolvedValueOnce({ Item: snapshotWithGuilds })  // plan: load snapshot for guild ids
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const response = await countdownHandler(makeEvent("inst-1"));

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe("COUNTDOWN");
        expect(body.guild_question_plan_id).toBeTruthy();
        expect(body.per_guild_question_index).toBeDefined();
    });

    it("returns 400 when there are no joined participants", async () => {
        const instance  = makeInstance({ status: "LOBBY" });
        const template  = makeTemplate();

        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: template })
            .mockResolvedValueOnce({ Items: [] }); // no participants

        const response = await countdownHandler(makeEvent("inst-1"));

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toBe("At least one joined participant is required");
    });

    it("returns 409 when instance status is already COUNTDOWN (pre-check)", async () => {
        const instance = makeInstance({ status: "COUNTDOWN" });
        mockSend.mockResolvedValueOnce({ Item: instance });

        const response = await countdownHandler(makeEvent("inst-1"));

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("LOBBY");
        expect(body.current_status).toBe("COUNTDOWN");
    });

    it("returns 409 when instance status is DRAFT", async () => {
        const instance = makeInstance({ status: "DRAFT" });
        mockSend.mockResolvedValueOnce({ Item: instance });

        const response = await countdownHandler(makeEvent("inst-1"));

        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).current_status).toBe("DRAFT");
    });

    it("returns 409 on concurrent second call (DB condition fails)", async () => {
        const instance     = makeInstance({ status: "LOBBY" });
        const template     = makeTemplate();
        const participants = [makeParticipant("s1")];
        const questions    = [makeQuestion("q1", "0001")];
        const condErr      = Object.assign(new Error("failed"), { name: "ConditionalCheckFailedException" });

        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: template })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: { ...instance, participants_snapshot_id: "snap-x" } })
            .mockResolvedValueOnce({ Items: questions })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(condErr); // countdown update fails

        const response = await countdownHandler(makeEvent("inst-1"));

        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).error).toContain("LOBBY");
    });

    it("returns 404 when instance does not exist", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });

        const response = await countdownHandler(makeEvent("nonexistent"));

        expect(response.statusCode).toBe(404);
        expect(JSON.parse(response.body).error).toBe("Boss battle instance not found");
    });

    it("returns 409 when referenced template is soft-deleted", async () => {
        const instance = makeInstance({ status: "LOBBY" });
        // getTemplate returns null for soft-deleted (is_deleted=true filtered by repo)
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: { ...makeTemplate(), is_deleted: true } });

        const response = await countdownHandler(makeEvent("inst-1"));

        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).error).toBe("Cannot start countdown from a deleted template");
    });

    it("returns 409 when referenced template does not exist", async () => {
        const instance = makeInstance({ status: "LOBBY" });
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: undefined });

        const response = await countdownHandler(makeEvent("inst-1"));

        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body).error).toBe("Cannot start countdown from a deleted template");
    });

    it("returns 400 when no boss questions exist for template", async () => {
        const instance     = makeInstance({ status: "LOBBY" });
        const template     = makeTemplate();
        const participants = [makeParticipant("s1")];

        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: template })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: { ...instance, participants_snapshot_id: "snap-1" } })
            .mockResolvedValueOnce({ Items: [] }); // no questions

        const response = await countdownHandler(makeEvent("inst-1"));

        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body).error).toBe("No boss questions found for template");
    });

    it("returns 400 when boss_instance_id path parameter is missing", async () => {
        const response = await countdownHandler({ pathParameters: {}, body: null });

        expect(response.statusCode).toBe(400);
    });

    it("uses default countdown_seconds when instance has none", async () => {
        const instance = makeInstance({ status: "LOBBY", countdown_seconds: undefined });
        const template = makeTemplate();
        const participants = [makeParticipant("s1")];
        const questions = [makeQuestion("q1", "0001")];
        const updatedInstance = makeInstance({
            status: "COUNTDOWN",
            countdown_seconds: undefined,
            countdown_end_at: "irrelevant-will-be-set",
            updated_at: "irrelevant",
            participants_snapshot_id: "snap-d",
            question_plan_id: "plan-d",
            current_question_index: 0,
        });

        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: template })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: { ...instance, participants_snapshot_id: "snap-d" } })
            .mockResolvedValueOnce({ Items: questions })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const response = await countdownHandler(makeEvent("inst-1"));

        // Just confirm it reached the countdown update (statusCode 200) without exploding
        expect(response.statusCode).toBe(200);

        // Verify at least one DynamoDB call set countdown_end_at (the final LOBBY->COUNTDOWN update)
        const countdownCall = mockSend.mock.calls.find(
            (c) => c[0]?.input?.ExpressionAttributeValues?.[":countdown_end_at"]
        );
        expect(countdownCall).toBeDefined();
        expect(countdownCall![0].input.ExpressionAttributeValues[":countdown_end_at"]).toBeTruthy();
    });
});

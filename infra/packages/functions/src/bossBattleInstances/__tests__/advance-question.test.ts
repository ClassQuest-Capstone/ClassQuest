/**
 * Unit tests for the AdvanceToNextQuestion lifecycle action.
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
let advanceQuestionHandler: (typeof import("../advance-question.ts"))["handler"];

beforeAll(async () => {
    process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME        = "test-bbi";
    process.env.BOSS_BATTLE_QUESTION_PLANS_TABLE_NAME   = "test-bbqp";
    process.env.BOSS_BATTLE_SNAPSHOTS_TABLE_NAME        = "test-bbs";
    process.env.BOSS_QUESTIONS_TABLE_NAME               = "test-bq";

    advanceQuestionHandler = (await import("../advance-question.ts")).handler;
});

beforeEach(() => {
    mockSend.mockReset();
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
        status:                 "INTERMISSION",
        mode_type:              "SIMULTANEOUS_ALL",
        question_plan_id:       "plan-1",
        current_question_index: 0,
        current_boss_hp:        500,
        initial_boss_hp:        1000,
        speed_bonus_enabled:    true,
        speed_bonus_floor_multiplier: 0.2,
        speed_window_seconds:   30,
        anti_spam_min_submit_interval_ms: 1000,
        freeze_on_wrong_seconds: 3,
        created_at:             "2026-01-01T00:00:00.000Z",
        updated_at:             "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeGlobalPlan(questionIds: string[] = ["q1", "q2", "q3"]) {
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

function makePerGuildPlan(
    guildIds = ["guild-1", "guild-2"],
    questionsPerGuild = ["q1", "q2"]
) {
    const guild_question_ids: Record<string, string[]> = {};
    const guild_question_count: Record<string, number> = {};
    for (const gid of guildIds) {
        guild_question_ids[gid] = [...questionsPerGuild];
        guild_question_count[gid] = questionsPerGuild.length;
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

function makeUpdatedInstance(overrides: Record<string, any> = {}) {
    return {
        ...makeInstance(),
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

// ---------------------------------------------------------------------------
// 1. Successful advance — more questions remain → stay in INTERMISSION
// ---------------------------------------------------------------------------
describe("advance with more questions remaining (SIMULTANEOUS_ALL)", () => {
    it("returns 200 with INTERMISSION status and incremented index", async () => {
        const updatedInstance = makeUpdatedInstance({ current_question_index: 1, status: "INTERMISSION" });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ current_question_index: 0 }) }) // getBossBattleInstance
            .mockResolvedValueOnce({ Item: makeGlobalPlan(["q1", "q2", "q3"]) })          // getQuestionPlan
            .mockResolvedValueOnce({ Attributes: updatedInstance });                        // advanceToNextQuestion

        const res = await advanceQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.status).toBe("INTERMISSION");
        expect(body.current_question_index).toBe(1);
        expect(body.has_more_questions).toBe(true);
        expect(body.outcome).toBeNull();
        expect(body.fail_reason).toBeNull();
    });

    it("passes next_index=1 to the DynamoDB update when starting from index 0", async () => {
        const updatedInstance = makeUpdatedInstance({ current_question_index: 1 });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ current_question_index: 0 }) })
            .mockResolvedValueOnce({ Item: makeGlobalPlan(["q1", "q2"]) })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        await advanceQuestionHandler(makeEvent());

        const updateCall = mockSend.mock.calls.find(
            (c: any) => c[0]?.input?.UpdateExpression?.includes("current_question_index")
        );
        expect(updateCall).toBeDefined();
        expect(updateCall![0].input.ExpressionAttributeValues[":next_question_index"]).toBe(1);
    });

    it("clears active_question_id via REMOVE in the update expression", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan(["q1", "q2"]) })
            .mockResolvedValueOnce({ Attributes: makeUpdatedInstance() });

        await advanceQuestionHandler(makeEvent());

        const updateCall = mockSend.mock.calls.find(
            (c: any) => c[0]?.input?.UpdateExpression?.includes("REMOVE")
        );
        expect(updateCall).toBeDefined();
        const expr: string = updateCall![0].input.UpdateExpression;
        expect(expr).toContain("REMOVE");
        expect(expr).toContain("#active_question_id");
    });
});

// ---------------------------------------------------------------------------
// 2. Successful advance — no more questions → COMPLETED FAIL OUT_OF_QUESTIONS
// ---------------------------------------------------------------------------
describe("advance with no more questions remaining", () => {
    it("returns COMPLETED/FAIL/OUT_OF_QUESTIONS when last question was just resolved", async () => {
        // Plan has 2 questions, currently at index 1 (just resolved last question), advancing to 2 → out of bounds
        const updatedInstance = makeUpdatedInstance({
            status: "COMPLETED",
            outcome: "FAIL",
            fail_reason: "OUT_OF_QUESTIONS",
            current_question_index: 2,
        });

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ current_question_index: 1 }) })
            .mockResolvedValueOnce({ Item: makeGlobalPlan(["q1", "q2"]) })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await advanceQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.status).toBe("COMPLETED");
        expect(body.outcome).toBe("FAIL");
        expect(body.fail_reason).toBe("OUT_OF_QUESTIONS");
        expect(body.has_more_questions).toBe(false);
    });

    it("includes completed_at in the DynamoDB update when out of questions", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ current_question_index: 1 }) })
            .mockResolvedValueOnce({ Item: makeGlobalPlan(["q1", "q2"]) })
            .mockResolvedValueOnce({ Attributes: makeUpdatedInstance({ status: "COMPLETED" }) });

        await advanceQuestionHandler(makeEvent());

        const updateCall = mockSend.mock.calls.find(
            (c: any) => c[0]?.input?.UpdateExpression?.includes("completed_at")
        );
        expect(updateCall).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// 3. State validation
// ---------------------------------------------------------------------------
describe("state validation", () => {
    it("returns 400 when boss_instance_id is missing", async () => {
        const res = await advanceQuestionHandler({ pathParameters: {} });
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/boss_instance_id/i);
    });

    it("returns 404 when instance not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const res = await advanceQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(404);
    });

    const invalidStatuses = [
        "DRAFT", "LOBBY", "COUNTDOWN", "QUESTION_ACTIVE", "RESOLVING", "COMPLETED", "ABORTED",
    ];
    for (const status of invalidStatuses) {
        it(`returns 409 when status is ${status}`, async () => {
            mockSend.mockResolvedValueOnce({ Item: makeInstance({ status }) });
            const res = await advanceQuestionHandler(makeEvent());
            expect(res.statusCode).toBe(409);
            expect(JSON.parse(res.body).error).toMatch(/INTERMISSION/i);
        });
    }

    it("returns 409 when boss HP is already 0 (already won)", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ current_boss_hp: 0 }) });
        const res = await advanceQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/already won/i);
    });

    it("returns 409 when question_plan_id is missing", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ question_plan_id: undefined }) });
        const res = await advanceQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/question_plan_id/i);
    });

    it("returns 404 when plan not found", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: undefined });
        const res = await advanceQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toMatch(/plan not found/i);
    });
});

// ---------------------------------------------------------------------------
// 4. Duplicate / concurrent advance blocked
// ---------------------------------------------------------------------------
describe("duplicate concurrent advance blocked by conditional update", () => {
    it("returns 409 when ConditionalCheckFailedException is thrown", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan() })
            .mockRejectedValueOnce(
                Object.assign(new Error("Condition check failed"), {
                    name: "ConditionalCheckFailedException",
                })
            );

        const res = await advanceQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/already advanced/i);
    });
});

// ---------------------------------------------------------------------------
// 5. TURN_BASED_GUILD — increments global index, clears active_guild_id
// ---------------------------------------------------------------------------
describe("TURN_BASED_GUILD mode", () => {
    it("increments current_question_index and includes active_guild_id in REMOVE", async () => {
        const tbgInstance = makeInstance({
            mode_type:              "TURN_BASED_GUILD",
            active_guild_id:        "guild-1",
            current_question_index: 0,
        });
        const updatedInstance = makeUpdatedInstance({
            mode_type:              "TURN_BASED_GUILD",
            current_question_index: 1,
        });

        mockSend
            .mockResolvedValueOnce({ Item: tbgInstance })
            .mockResolvedValueOnce({ Item: makeGlobalPlan(["q1", "q2"]) })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await advanceQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.current_question_index).toBe(1);
        expect(body.has_more_questions).toBe(true);

        // active_guild_id should be in REMOVE clause
        const updateCall = mockSend.mock.calls.find(
            (c: any) => c[0]?.input?.UpdateExpression?.includes("REMOVE")
        );
        const expr: string = updateCall![0].input.UpdateExpression;
        expect(expr).toContain("#active_guild_id");
    });
});

// ---------------------------------------------------------------------------
// 6. RANDOMIZED_PER_GUILD — advances all guild indexes
// ---------------------------------------------------------------------------
describe("RANDOMIZED_PER_GUILD mode", () => {
    it("increments all guild indexes and returns has_more_questions=true", async () => {
        const pgInstance = makeInstance({
            mode_type:               "RANDOMIZED_PER_GUILD",
            guild_question_plan_id:  "plan-pg",
            question_plan_id:        undefined,
            per_guild_question_index: { "guild-1": 0, "guild-2": 0 },
            current_question_index:  0,
        });
        const updatedInstance = makeUpdatedInstance({
            mode_type:               "RANDOMIZED_PER_GUILD",
            per_guild_question_index: { "guild-1": 1, "guild-2": 1 },
        });

        mockSend
            .mockResolvedValueOnce({ Item: pgInstance })
            .mockResolvedValueOnce({ Item: makePerGuildPlan(["guild-1", "guild-2"], ["q1", "q2"]) })
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await advanceQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.has_more_questions).toBe(true);
        expect(body.per_guild_question_index).toEqual({ "guild-1": 1, "guild-2": 1 });
    });

    it("marks COMPLETED/FAIL/OUT_OF_QUESTIONS when all guild questions exhausted", async () => {
        const pgInstance = makeInstance({
            mode_type:               "RANDOMIZED_PER_GUILD",
            guild_question_plan_id:  "plan-pg",
            question_plan_id:        undefined,
            per_guild_question_index: { "guild-1": 1, "guild-2": 1 }, // at last question
            current_question_index:  1,
        });
        const updatedInstance = makeUpdatedInstance({
            status:     "COMPLETED",
            outcome:    "FAIL",
            fail_reason: "OUT_OF_QUESTIONS",
            per_guild_question_index: { "guild-1": 2, "guild-2": 2 },
        });

        mockSend
            .mockResolvedValueOnce({ Item: pgInstance })
            .mockResolvedValueOnce({ Item: makePerGuildPlan(["guild-1", "guild-2"], ["q1", "q2"]) }) // 2 questions each
            .mockResolvedValueOnce({ Attributes: updatedInstance });

        const res = await advanceQuestionHandler(makeEvent());
        const body = JSON.parse(res.body);

        expect(res.statusCode).toBe(200);
        expect(body.status).toBe("COMPLETED");
        expect(body.outcome).toBe("FAIL");
        expect(body.fail_reason).toBe("OUT_OF_QUESTIONS");
        expect(body.has_more_questions).toBe(false);
    });

    it("returns 409 when guild_question_plan_id is missing", async () => {
        mockSend.mockResolvedValueOnce({
            Item: makeInstance({
                mode_type:              "RANDOMIZED_PER_GUILD",
                guild_question_plan_id: undefined,
            }),
        });
        const res = await advanceQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toMatch(/guild_question_plan_id/i);
    });
});

// ---------------------------------------------------------------------------
// 7. Quorum field clearing on advance
// ---------------------------------------------------------------------------
describe("quorum field clearing on advance", () => {
    it("clears all quorum fields via REMOVE in the update expression", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Item: makeGlobalPlan(["q1", "q2"]) })
            .mockResolvedValueOnce({ Attributes: makeUpdatedInstance() });

        await advanceQuestionHandler(makeEvent());

        const updateCall = mockSend.mock.calls.find(
            (c: any) => c[0]?.input?.UpdateExpression?.includes("REMOVE")
        );
        expect(updateCall).toBeDefined();
        const expr: string = updateCall![0].input.UpdateExpression;

        expect(expr).toContain("#required_answer_count");
        expect(expr).toContain("#received_answer_count");
        expect(expr).toContain("#ready_to_resolve");
        expect(expr).toContain("#per_guild_required_answer_count");
        expect(expr).toContain("#per_guild_received_answer_count");
        expect(expr).toContain("#per_guild_ready_to_resolve");
    });

    it("stale ready_to_resolve from previous question does not appear on returned instance", async () => {
        // Simulate instance that had ready_to_resolve=true from previous question
        const staleInstance = makeInstance({ ready_to_resolve: true, received_answer_count: 3, required_answer_count: 3 });
        // After advance, repo clears those fields — returned instance omits them
        const clearedInstance = makeUpdatedInstance({
            current_question_index: 1,
            // quorum fields absent (simulating REMOVE having cleared them)
        });
        delete (clearedInstance as any).ready_to_resolve;
        delete (clearedInstance as any).received_answer_count;
        delete (clearedInstance as any).required_answer_count;

        mockSend
            .mockResolvedValueOnce({ Item: staleInstance })
            .mockResolvedValueOnce({ Item: makeGlobalPlan(["q1", "q2", "q3"]) })
            .mockResolvedValueOnce({ Attributes: clearedInstance });

        const res = await advanceQuestionHandler(makeEvent());
        expect(res.statusCode).toBe(200);

        // The handler response body maps from the returned instance; quorum fields should be absent
        const body = JSON.parse(res.body);
        expect(body.ready_to_resolve).toBeUndefined();
        expect(body.received_answer_count).toBeUndefined();
        expect(body.required_answer_count).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 8. Quest API stack wiring
// ---------------------------------------------------------------------------
describe("QuestApiStack and router wiring", () => {
    it("QuestApiStack includes the advance-question route", async () => {
        const { readFileSync } = await import("fs");
        const stackContent = readFileSync(
            new URL("../../../../../stacks/QuestApiStack.ts", import.meta.url),
            "utf-8"
        );
        expect(stackContent).toContain("advance-question");
        expect(stackContent).toContain(
            "/boss-battle-instances/{boss_instance_id}/advance-question"
        );
    });

    it("quest-router includes the advance-question handler", async () => {
        const { readFileSync } = await import("fs");
        const routerContent = readFileSync(
            new URL("../../quest-router/router.ts", import.meta.url),
            "utf-8"
        );
        expect(routerContent).toContain("advance-question");
        expect(routerContent).toContain("bbiAdvanceQuestion");
    });
});

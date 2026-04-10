/**
 * Unit tests for bossBattleQuestionPlans/repo.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DynamoDB — hoisted before any module imports
// ---------------------------------------------------------------------------
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: vi.fn(function () { return {}; }),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(function () { return { send: mockSend }; }),
    },
    GetCommand:    vi.fn(function (input: any) { return { input }; }),
    PutCommand:    vi.fn(function (input: any) { return { input }; }),
    UpdateCommand: vi.fn(function (input: any) { return { input }; }),
    QueryCommand:  vi.fn(function (input: any) { return { input }; }),
}));

// ---------------------------------------------------------------------------
// Module reference
// ---------------------------------------------------------------------------
let repoModule: typeof import("../repo.ts");

beforeAll(async () => {
    process.env.BOSS_BATTLE_QUESTION_PLANS_TABLE_NAME = "test-plans";
    process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME      = "test-instances";
    process.env.BOSS_BATTLE_SNAPSHOTS_TABLE_NAME      = "test-snapshots";
    process.env.BOSS_QUESTIONS_TABLE_NAME             = "test-questions";
    repoModule = await import("../repo.ts");
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeInstance(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id:           "inst-1",
        status:                     "LOBBY",
        mode_type:                  "SIMULTANEOUS_ALL",
        question_selection_mode:    "ORDERED",
        boss_template_id:           "template-1",
        class_id:                   "class-1",
        participants_snapshot_id:   undefined,
        ...overrides,
    };
}

function makeQuestion(id: string, orderKey: string) {
    return { question_id: id, order_key: orderKey, boss_template_id: "template-1" };
}

function makePlan(overrides: Record<string, any> = {}) {
    return {
        plan_id:            "plan-1",
        boss_instance_id:   "inst-1",
        class_id:           "class-1",
        boss_template_id:   "template-1",
        mode_type:          "SIMULTANEOUS_ALL",
        question_selection_mode: "ORDERED",
        created_by_teacher_id: "teacher-1",
        created_at:         "2026-04-09T10:00:00.000Z",
        version:            1,
        question_ids:       ["q-1", "q-2"],
        question_count:     2,
        seed:               "some-seed",
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// getQuestionPlan
// ---------------------------------------------------------------------------
describe("getQuestionPlan", () => {
    it("sends GetCommand with correct TableName and Key", async () => {
        mockSend.mockResolvedValue({ Item: makePlan() });

        await repoModule.getQuestionPlan("plan-1");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.TableName).toBe("test-plans");
        expect(cmd.input.Key).toEqual({ plan_id: "plan-1" });
    });

    it("returns plan when found", async () => {
        const plan = makePlan();
        mockSend.mockResolvedValue({ Item: plan });

        const result = await repoModule.getQuestionPlan("plan-1");

        expect(result).not.toBeNull();
        expect(result!.plan_id).toBe("plan-1");
        expect(result!.boss_instance_id).toBe("inst-1");
    });

    it("returns null when not found", async () => {
        mockSend.mockResolvedValue({ Item: undefined });

        const result = await repoModule.getQuestionPlan("missing-plan");

        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// listPlansByInstance
// ---------------------------------------------------------------------------
describe("listPlansByInstance", () => {
    it("queries gsi1 with boss_instance_id and default Limit 50", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listPlansByInstance("inst-1");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.TableName).toBe("test-plans");
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.ExpressionAttributeValues[":boss_instance_id"]).toBe("inst-1");
        expect(cmd.input.Limit).toBe(50);
    });

    it("uses custom limit when provided", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listPlansByInstance("inst-1", { limit: 10 });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Limit).toBe(10);
    });

    it("decodes nextToken into ExclusiveStartKey", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        const key = { plan_id: "plan-1", boss_instance_id: "inst-1" };
        const token = Buffer.from(JSON.stringify(key)).toString("base64");

        await repoModule.listPlansByInstance("inst-1", { nextToken: token });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExclusiveStartKey).toEqual(key);
    });

    it("encodes LastEvaluatedKey as nextToken in response", async () => {
        const lek = { plan_id: "plan-1", boss_instance_id: "inst-1" };
        mockSend.mockResolvedValue({ Items: [makePlan()], LastEvaluatedKey: lek });

        const result = await repoModule.listPlansByInstance("inst-1");

        expect(result.nextToken).toBe(Buffer.from(JSON.stringify(lek)).toString("base64"));
    });

    it("returns undefined nextToken when no LastEvaluatedKey", async () => {
        mockSend.mockResolvedValue({ Items: [makePlan()] });

        const result = await repoModule.listPlansByInstance("inst-1");

        expect(result.nextToken).toBeUndefined();
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValue({ Items: undefined });

        const result = await repoModule.listPlansByInstance("inst-1");

        expect(result.items).toEqual([]);
    });

    it("returns items when present", async () => {
        const plan = makePlan();
        mockSend.mockResolvedValue({ Items: [plan] });

        const result = await repoModule.listPlansByInstance("inst-1");

        expect(result.items).toHaveLength(1);
        expect(result.items[0].plan_id).toBe("plan-1");
    });
});

// ---------------------------------------------------------------------------
// createQuestionPlanForInstance — guard cases
// ---------------------------------------------------------------------------
describe("createQuestionPlanForInstance — guards", () => {
    const baseInput = {
        boss_instance_id:       "inst-1",
        created_by_teacher_id:  "teacher-1",
    };

    it("throws when instance is not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });

        await expect(repoModule.createQuestionPlanForInstance(baseInput))
            .rejects.toThrow("not found");

        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("throws when instance status is not LOBBY or COUNTDOWN", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "COMPLETED" }) });

        await expect(repoModule.createQuestionPlanForInstance(baseInput))
            .rejects.toThrow("COMPLETED");

        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("throws when no questions exist for the template", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })       // GetCommand instance
            .mockResolvedValueOnce({ Items: [] });                 // QueryCommand questions

        await expect(repoModule.createQuestionPlanForInstance(baseInput))
            .rejects.toThrow("No questions found");

        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("throws for RANDOMIZED_PER_GUILD when no snapshot_id", async () => {
        const instance = makeInstance({
            mode_type: "RANDOMIZED_PER_GUILD",
            participants_snapshot_id: undefined,
        });
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Items: [makeQuestion("q-1", "0001")] });

        await expect(repoModule.createQuestionPlanForInstance(baseInput))
            .rejects.toThrow("no participants snapshot");

        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("throws for RANDOMIZED_PER_GUILD when snapshot not found", async () => {
        const instance = makeInstance({
            mode_type: "RANDOMIZED_PER_GUILD",
            participants_snapshot_id: "snap-1",
        });
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Items: [makeQuestion("q-1", "0001")] })
            .mockResolvedValueOnce({ Item: undefined });   // snapshot missing

        await expect(repoModule.createQuestionPlanForInstance(baseInput))
            .rejects.toThrow("not found");

        expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it("throws for RANDOMIZED_PER_GUILD when snapshot has no guilds", async () => {
        const instance = makeInstance({
            mode_type: "RANDOMIZED_PER_GUILD",
            participants_snapshot_id: "snap-1",
        });
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Items: [makeQuestion("q-1", "0001")] })
            .mockResolvedValueOnce({ Item: { snapshot_id: "snap-1", guild_counts: {} } });

        await expect(repoModule.createQuestionPlanForInstance(baseInput))
            .rejects.toThrow("No guilds found");

        expect(mockSend).toHaveBeenCalledTimes(3);
    });
});

// ---------------------------------------------------------------------------
// createQuestionPlanForInstance — global plan (SIMULTANEOUS_ALL)
// ---------------------------------------------------------------------------
describe("createQuestionPlanForInstance — SIMULTANEOUS_ALL ORDERED", () => {
    const input = {
        boss_instance_id:       "inst-1",
        created_by_teacher_id:  "teacher-1",
    };

    it("writes PutCommand with mode_type and question_ids", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })                                   // GetCommand instance
            .mockResolvedValueOnce({ Items: [makeQuestion("q-1", "0001"), makeQuestion("q-2", "0002")] }) // QueryCommand questions
            .mockResolvedValueOnce({})                                                         // PutCommand plan
            .mockResolvedValueOnce({});                                                        // UpdateCommand instance

        const result = await repoModule.createQuestionPlanForInstance(input);

        const putCmd = mockSend.mock.calls[2][0];
        const item = putCmd.input.Item;
        expect(putCmd.input.TableName).toBe("test-plans");
        expect(item.mode_type).toBe("SIMULTANEOUS_ALL");
        expect(item.question_selection_mode).toBe("ORDERED");
        expect(item.boss_instance_id).toBe("inst-1");
        expect(item.question_ids).toEqual(["q-1", "q-2"]);
        expect(item.question_count).toBe(2);
    });

    it("sends UpdateCommand to boss instances table with plan_id", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Items: [makeQuestion("q-1", "0001")] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        const result = await repoModule.createQuestionPlanForInstance(input);

        const updateCmd = mockSend.mock.calls[3][0];
        expect(updateCmd.input.TableName).toBe("test-instances");
        expect(updateCmd.input.Key).toEqual({ boss_instance_id: "inst-1" });
        expect(updateCmd.input.ExpressionAttributeValues[":plan_id"]).toBe(result.plan_id);
        expect(updateCmd.input.ExpressionAttributeValues[":zero"]).toBe(0);
        expect(updateCmd.input.ConditionExpression).toContain("attribute_not_exists");
    });

    it("returns plan with expected shape", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Items: [makeQuestion("q-1", "0001"), makeQuestion("q-2", "0002")] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        const result = await repoModule.createQuestionPlanForInstance(input);

        expect(result.plan_id).toBeTruthy();
        expect(result.boss_instance_id).toBe("inst-1");
        expect(result.class_id).toBe("class-1");
        expect(result.mode_type).toBe("SIMULTANEOUS_ALL");
        expect((result as any).question_ids).toHaveLength(2);
        expect(result.version).toBe(1);
    });

    it("sorts questions by order_key before assigning", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            // Return questions out of order
            .mockResolvedValueOnce({ Items: [makeQuestion("q-3", "0003"), makeQuestion("q-1", "0001"), makeQuestion("q-2", "0002")] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        const result = await repoModule.createQuestionPlanForInstance(input);

        expect((result as any).question_ids).toEqual(["q-1", "q-2", "q-3"]);
    });

    it("accepts COUNTDOWN status", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ status: "COUNTDOWN" }) })
            .mockResolvedValueOnce({ Items: [makeQuestion("q-1", "0001")] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        await expect(repoModule.createQuestionPlanForInstance(input)).resolves.toBeDefined();
    });

    it("throws 'already exists' when ConditionalCheckFailedException on UpdateCommand", async () => {
        const err = new Error("ConditionalCheckFailed");
        err.name = "ConditionalCheckFailedException";

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Items: [makeQuestion("q-1", "0001")] })
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(err);

        await expect(repoModule.createQuestionPlanForInstance(input))
            .rejects.toThrow("already exists");
    });
});

// ---------------------------------------------------------------------------
// createQuestionPlanForInstance — SIMULTANEOUS_ALL RANDOM_NO_REPEAT
// ---------------------------------------------------------------------------
describe("createQuestionPlanForInstance — SIMULTANEOUS_ALL RANDOM_NO_REPEAT", () => {
    const input = {
        boss_instance_id:       "inst-1",
        created_by_teacher_id:  "teacher-1",
    };

    it("shuffles questions with seeded shuffle (all IDs still present)", async () => {
        const instance = makeInstance({ question_selection_mode: "RANDOM_NO_REPEAT" });
        const questions = [
            makeQuestion("q-1", "0001"),
            makeQuestion("q-2", "0002"),
            makeQuestion("q-3", "0003"),
            makeQuestion("q-4", "0004"),
        ];

        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Items: questions })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        const result = await repoModule.createQuestionPlanForInstance(input);

        const ids = (result as any).question_ids as string[];
        expect(ids).toHaveLength(4);
        expect(ids.sort()).toEqual(["q-1", "q-2", "q-3", "q-4"]);
    });
});

// ---------------------------------------------------------------------------
// createQuestionPlanForInstance — RANDOMIZED_PER_GUILD
// ---------------------------------------------------------------------------
describe("createQuestionPlanForInstance — RANDOMIZED_PER_GUILD", () => {
    const input = {
        boss_instance_id:       "inst-1",
        created_by_teacher_id:  "teacher-1",
    };

    function makePerGuildInstance(selectionMode = "ORDERED") {
        return makeInstance({
            mode_type: "RANDOMIZED_PER_GUILD",
            question_selection_mode: selectionMode,
            participants_snapshot_id: "snap-1",
        });
    }

    it("creates per-guild plan with guild_question_ids and guild_question_count", async () => {
        const snapshot = {
            snapshot_id: "snap-1",
            guild_counts: { "guild-A": 3, "guild-B": 2 },
        };
        mockSend
            .mockResolvedValueOnce({ Item: makePerGuildInstance() })
            .mockResolvedValueOnce({ Items: [makeQuestion("q-1", "0001"), makeQuestion("q-2", "0002")] })
            .mockResolvedValueOnce({ Item: snapshot })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        const result = await repoModule.createQuestionPlanForInstance(input);

        expect((result as any).guild_question_ids).toBeDefined();
        expect(Object.keys((result as any).guild_question_ids)).toContain("guild-A");
        expect(Object.keys((result as any).guild_question_ids)).toContain("guild-B");
        expect((result as any).guild_question_count["guild-A"]).toBe(2);
        expect((result as any).guild_question_count["guild-B"]).toBe(2);
    });

    it("for ORDERED, all guilds get the same sorted question list", async () => {
        const snapshot = {
            snapshot_id: "snap-1",
            guild_counts: { "guild-A": 3, "guild-B": 2 },
        };
        mockSend
            .mockResolvedValueOnce({ Item: makePerGuildInstance("ORDERED") })
            .mockResolvedValueOnce({ Items: [makeQuestion("q-2", "0002"), makeQuestion("q-1", "0001")] })
            .mockResolvedValueOnce({ Item: snapshot })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        const result = await repoModule.createQuestionPlanForInstance(input);

        const gqi = (result as any).guild_question_ids;
        expect(gqi["guild-A"]).toEqual(["q-1", "q-2"]);
        expect(gqi["guild-B"]).toEqual(["q-1", "q-2"]);
    });

    it("writes UpdateCommand with per_guild_question_index map", async () => {
        const snapshot = {
            snapshot_id: "snap-1",
            guild_counts: { "guild-A": 3 },
        };
        mockSend
            .mockResolvedValueOnce({ Item: makePerGuildInstance() })
            .mockResolvedValueOnce({ Items: [makeQuestion("q-1", "0001")] })
            .mockResolvedValueOnce({ Item: snapshot })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        await repoModule.createQuestionPlanForInstance(input);

        const updateCmd = mockSend.mock.calls[4][0];
        expect(updateCmd.input.ExpressionAttributeValues[":per_guild_index"]).toEqual({ "guild-A": 0 });
        expect(updateCmd.input.UpdateExpression).toContain("per_guild_question_index");
        expect(updateCmd.input.UpdateExpression).toContain("guild_question_plan_id");
    });

    it("throws 'already exists' when ConditionalCheckFailedException on UpdateCommand", async () => {
        const snapshot = {
            snapshot_id: "snap-1",
            guild_counts: { "guild-A": 1 },
        };
        const err = new Error("ConditionalCheckFailed");
        err.name = "ConditionalCheckFailedException";

        mockSend
            .mockResolvedValueOnce({ Item: makePerGuildInstance() })
            .mockResolvedValueOnce({ Items: [makeQuestion("q-1", "0001")] })
            .mockResolvedValueOnce({ Item: snapshot })
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(err);

        await expect(repoModule.createQuestionPlanForInstance(input))
            .rejects.toThrow("already exists");
    });
});

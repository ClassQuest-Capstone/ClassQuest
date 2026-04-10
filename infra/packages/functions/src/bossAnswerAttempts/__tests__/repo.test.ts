/**
 * Unit tests for bossAnswerAttempts/repo.ts
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
    PutCommand:   vi.fn(function (input: any) { return { input }; }),
    QueryCommand: vi.fn(function (input: any) { return { input }; }),
    GetCommand:   vi.fn(function (input: any) { return { input }; }),
}));

// ---------------------------------------------------------------------------
// Module references
// ---------------------------------------------------------------------------
let repoModule: typeof import("../repo.ts");

beforeAll(async () => {
    process.env.BOSS_ANSWER_ATTEMPTS_TABLE_NAME = "test-boss-answer-attempts";
    repoModule = await import("../repo.ts");
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeInput(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id:        "inst-1",
        class_id:                "class-1",
        question_id:             "q-1",
        student_id:              "student-1",
        guild_id:                "guild-1",
        answer_raw:              { selected: "A" },
        is_correct:              true,
        elapsed_seconds:         10,
        damage_to_boss:          50,
        hearts_delta_student:    0,
        hearts_delta_guild_total: 0,
        mode_type:               "SIMULTANEOUS_ALL" as const,
        status_at_submit:        "QUESTION_ACTIVE" as const,
        ...overrides,
    };
}

function makeAttemptItem(overrides: Record<string, any> = {}) {
    return {
        boss_attempt_pk:         "BI#inst-1#Q#q-1",
        attempt_sk:              "T#2026-04-09T10:00:00.000Z#S#student-1#A#uuid-1",
        boss_instance_id:        "inst-1",
        class_id:                "class-1",
        question_id:             "q-1",
        student_id:              "student-1",
        guild_id:                "guild-1",
        answer_raw:              { selected: "A" },
        is_correct:              true,
        answered_at:             "2026-04-09T10:00:00.000Z",
        elapsed_seconds:         10,
        damage_to_boss:          50,
        hearts_delta_student:    0,
        hearts_delta_guild_total: 0,
        mode_type:               "SIMULTANEOUS_ALL",
        status_at_submit:        "QUESTION_ACTIVE",
        gsi2_sk:                 "2026-04-09T10:00:00.000Z#inst-1#q-1",
        gsi3_pk:                 "inst-1#student-1",
        gsi3_sk:                 "2026-04-09T10:00:00.000Z#q-1",
        ...overrides,
    };
}

// Encode a DynamoDB LastEvaluatedKey the same way the repo does
function encodeToken(key: Record<string, any>): string {
    return Buffer.from(JSON.stringify(key)).toString("base64");
}

// ---------------------------------------------------------------------------
// createBossAnswerAttempt
// ---------------------------------------------------------------------------
describe("createBossAnswerAttempt", () => {
    it("calls PutCommand with correct TableName and Item", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.createBossAnswerAttempt(makeInput());

        expect(mockSend).toHaveBeenCalledOnce();
        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;

        expect(params.TableName).toBe("test-boss-answer-attempts");
        expect(params.Item).toBeDefined();
    });

    it("sets boss_attempt_pk in BI#<id>#Q#<id> format", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.createBossAnswerAttempt(makeInput());

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Item.boss_attempt_pk).toBe("BI#inst-1#Q#q-1");
    });

    it("sets attempt_sk starting with T#<iso-ts>#S#<student_id>#A#", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.createBossAnswerAttempt(makeInput());

        const [cmd] = mockSend.mock.calls[0];
        const sk = cmd.input.Item.attempt_sk as string;
        expect(sk).toMatch(/^T#\d{4}-\d{2}-\d{2}T/);
        expect(sk).toContain("#S#student-1#A#");
    });

    it("sets all three GSI keys correctly", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.createBossAnswerAttempt(makeInput());

        const [cmd] = mockSend.mock.calls[0];
        const item = cmd.input.Item;

        // gsi2_sk = answered_at#boss_instance_id#question_id
        expect(item.gsi2_sk).toContain("#inst-1#q-1");
        // gsi3_pk = boss_instance_id#student_id
        expect(item.gsi3_pk).toBe("inst-1#student-1");
        // gsi3_sk = answered_at#question_id
        expect(item.gsi3_sk).toContain("#q-1");
    });

    it("copies all required input fields onto the saved item", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.createBossAnswerAttempt(makeInput({ xp_earned: 25 }));

        const [cmd] = mockSend.mock.calls[0];
        const item = cmd.input.Item;

        expect(item.boss_instance_id).toBe("inst-1");
        expect(item.class_id).toBe("class-1");
        expect(item.question_id).toBe("q-1");
        expect(item.student_id).toBe("student-1");
        expect(item.guild_id).toBe("guild-1");
        expect(item.is_correct).toBe(true);
        expect(item.damage_to_boss).toBe(50);
        expect(item.mode_type).toBe("SIMULTANEOUS_ALL");
        expect(item.status_at_submit).toBe("QUESTION_ACTIVE");
        expect(item.xp_earned).toBe(25);
    });

    it("returns the item that was written", async () => {
        mockSend.mockResolvedValue({});

        const result = await repoModule.createBossAnswerAttempt(makeInput());

        expect(result).toBeDefined();
        expect(result.boss_instance_id).toBe("inst-1");
        expect(result.boss_attempt_pk).toBe("BI#inst-1#Q#q-1");
        // answered_at should be a valid ISO timestamp
        expect(result.answered_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("ProvisionedThroughputExceededException"));

        await expect(repoModule.createBossAnswerAttempt(makeInput()))
            .rejects.toThrow("ProvisionedThroughputExceededException");
    });
});

// ---------------------------------------------------------------------------
// listAttemptsByBattle
// ---------------------------------------------------------------------------
describe("listAttemptsByBattle", () => {
    it("queries gsi1 with boss_instance_id and default limit 50", async () => {
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

        await repoModule.listAttemptsByBattle("inst-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;

        expect(params.IndexName).toBe("gsi1");
        expect(params.KeyConditionExpression).toContain("boss_instance_id");
        expect(params.ExpressionAttributeValues[":boss_instance_id"]).toBe("inst-1");
        expect(params.Limit).toBe(50);
        expect(params.ExclusiveStartKey).toBeUndefined();
    });

    it("respects custom limit", async () => {
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

        await repoModule.listAttemptsByBattle("inst-1", { limit: 10 });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Limit).toBe(10);
    });

    it("decodes nextToken into ExclusiveStartKey", async () => {
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

        const lastKey = { boss_attempt_pk: "BI#inst-1#Q#q-1", attempt_sk: "T#ts#S#s#A#u" };
        const token = encodeToken(lastKey);

        await repoModule.listAttemptsByBattle("inst-1", { nextToken: token });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lastKey);
    });

    it("returns items from DynamoDB result", async () => {
        const item = makeAttemptItem();
        mockSend.mockResolvedValue({ Items: [item], LastEvaluatedKey: undefined });

        const result = await repoModule.listAttemptsByBattle("inst-1");

        expect(result.items).toHaveLength(1);
        expect(result.items[0].boss_instance_id).toBe("inst-1");
        expect(result.nextToken).toBeUndefined();
    });

    it("encodes LastEvaluatedKey into nextToken when present", async () => {
        const lastKey = { boss_attempt_pk: "BI#inst-1#Q#q-1", attempt_sk: "T#ts#S#s#A#u" };
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: lastKey });

        const result = await repoModule.listAttemptsByBattle("inst-1");

        expect(result.nextToken).toBe(encodeToken(lastKey));
    });

    it("returns empty items array when DynamoDB returns no Items", async () => {
        mockSend.mockResolvedValue({ Items: undefined, LastEvaluatedKey: undefined });

        const result = await repoModule.listAttemptsByBattle("inst-1");

        expect(result.items).toEqual([]);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("ServiceUnavailable"));

        await expect(repoModule.listAttemptsByBattle("inst-1"))
            .rejects.toThrow("ServiceUnavailable");
    });
});

// ---------------------------------------------------------------------------
// listAttemptsByStudent
// ---------------------------------------------------------------------------
describe("listAttemptsByStudent", () => {
    it("queries gsi2 with student_id and default limit 50", async () => {
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

        await repoModule.listAttemptsByStudent("student-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;

        expect(params.IndexName).toBe("gsi2");
        expect(params.ExpressionAttributeValues[":student_id"]).toBe("student-1");
        expect(params.Limit).toBe(50);
    });

    it("decodes nextToken into ExclusiveStartKey", async () => {
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

        const lastKey = { student_id: "student-1", gsi2_sk: "ts#inst-1#q-1" };
        const token = encodeToken(lastKey);

        await repoModule.listAttemptsByStudent("student-1", { nextToken: token });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lastKey);
    });

    it("encodes LastEvaluatedKey into nextToken", async () => {
        const lastKey = { student_id: "student-1", gsi2_sk: "ts#inst-1#q-1" };
        mockSend.mockResolvedValue({ Items: [makeAttemptItem()], LastEvaluatedKey: lastKey });

        const result = await repoModule.listAttemptsByStudent("student-1");

        expect(result.nextToken).toBe(encodeToken(lastKey));
        expect(result.items).toHaveLength(1);
    });

    it("returns empty items when DynamoDB returns nothing", async () => {
        mockSend.mockResolvedValue({ Items: undefined });

        const result = await repoModule.listAttemptsByStudent("student-1");

        expect(result.items).toEqual([]);
        expect(result.nextToken).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// listAttemptsByBattleStudent
// ---------------------------------------------------------------------------
describe("listAttemptsByBattleStudent", () => {
    it("queries gsi3 with gsi3_pk = boss_instance_id#student_id", async () => {
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

        await repoModule.listAttemptsByBattleStudent("inst-1", "student-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;

        expect(params.IndexName).toBe("gsi3");
        expect(params.ExpressionAttributeValues[":gsi3_pk"]).toBe("inst-1#student-1");
        expect(params.Limit).toBe(50);
    });

    it("decodes nextToken and encodes LastEvaluatedKey correctly", async () => {
        const lastKey = { gsi3_pk: "inst-1#student-1", gsi3_sk: "ts#q-1" };
        const token = encodeToken(lastKey);
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: lastKey });

        const result = await repoModule.listAttemptsByBattleStudent("inst-1", "student-1", {
            nextToken: token,
        });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lastKey);
        expect(result.nextToken).toBe(encodeToken(lastKey));
    });
});

// ---------------------------------------------------------------------------
// getStudentAttemptForQuestion
// ---------------------------------------------------------------------------
describe("getStudentAttemptForQuestion", () => {
    it("queries main table with boss_attempt_pk and FilterExpression for student_id", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.getStudentAttemptForQuestion("inst-1", "q-1", "student-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;

        expect(params.KeyConditionExpression).toContain("boss_attempt_pk");
        expect(params.FilterExpression).toContain("student_id");
        expect(params.ExpressionAttributeValues[":pk"]).toBe("BI#inst-1#Q#q-1");
        expect(params.ExpressionAttributeValues[":student_id"]).toBe("student-1");
        expect(params.Limit).toBe(1);
        // Should NOT have IndexName — this is a main table query
        expect(params.IndexName).toBeUndefined();
    });

    it("returns null when no matching item found", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        const result = await repoModule.getStudentAttemptForQuestion("inst-1", "q-1", "student-1");

        expect(result).toBeNull();
    });

    it("returns first item when a match exists", async () => {
        const item = makeAttemptItem();
        mockSend.mockResolvedValue({ Items: [item] });

        const result = await repoModule.getStudentAttemptForQuestion("inst-1", "q-1", "student-1");

        expect(result).not.toBeNull();
        expect(result!.student_id).toBe("student-1");
    });
});

// ---------------------------------------------------------------------------
// listAttemptsByBattleQuestion
// ---------------------------------------------------------------------------
describe("listAttemptsByBattleQuestion", () => {
    it("queries main table (no IndexName) with boss_attempt_pk", async () => {
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

        await repoModule.listAttemptsByBattleQuestion("inst-1", "q-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;

        expect(params.IndexName).toBeUndefined();
        expect(params.ExpressionAttributeValues[":pk"]).toBe("BI#inst-1#Q#q-1");
        expect(params.Limit).toBe(100); // default for this function is 100
    });

    it("encodes LastEvaluatedKey into nextToken", async () => {
        const lastKey = { boss_attempt_pk: "BI#inst-1#Q#q-1", attempt_sk: "T#ts#S#s#A#u" };
        mockSend.mockResolvedValue({ Items: [makeAttemptItem()], LastEvaluatedKey: lastKey });

        const result = await repoModule.listAttemptsByBattleQuestion("inst-1", "q-1");

        expect(result.items).toHaveLength(1);
        expect(result.nextToken).toBe(encodeToken(lastKey));
    });

    it("decodes nextToken into ExclusiveStartKey", async () => {
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

        const lastKey = { boss_attempt_pk: "BI#inst-1#Q#q-1", attempt_sk: "T#ts#S#s#A#u" };
        const token = encodeToken(lastKey);

        await repoModule.listAttemptsByBattleQuestion("inst-1", "q-1", { nextToken: token });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lastKey);
    });
});

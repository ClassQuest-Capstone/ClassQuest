import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  DynamoDB mock boilerplate                                         */
/* ------------------------------------------------------------------ */
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: vi.fn(function () { return {}; }),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(function () { return { send: mockSend }; }),
    },
    PutCommand:   vi.fn(function (input: any) { return { input }; }),
    GetCommand:   vi.fn(function (input: any) { return { input }; }),
    QueryCommand: vi.fn(function (input: any) { return { input }; }),
}));

/* ------------------------------------------------------------------ */
/*  External module mocks (used by computeAndWriteBossResults)         */
/* ------------------------------------------------------------------ */
const mockPutTransaction  = vi.fn();
const mockApplyXpAndGold  = vi.fn();
const mockGetPlayerState  = vi.fn();

vi.mock("../../rewardTransactions/repo.js", () => ({
    putTransaction: (...args: any[]) => mockPutTransaction(...args),
}));
vi.mock("../../rewardTransactions/repo.ts", () => ({
    putTransaction: (...args: any[]) => mockPutTransaction(...args),
}));

vi.mock("../../playerStates/repo.js", () => ({
    applyXpAndGold: (...args: any[]) => mockApplyXpAndGold(...args),
    getPlayerState: (...args: any[]) => mockGetPlayerState(...args),
}));
vi.mock("../../playerStates/repo.ts", () => ({
    applyXpAndGold: (...args: any[]) => mockApplyXpAndGold(...args),
    getPlayerState: (...args: any[]) => mockGetPlayerState(...args),
}));

/* ------------------------------------------------------------------ */
/*  Module under test                                                  */
/* ------------------------------------------------------------------ */
let repo: typeof import("../repo.ts");

beforeAll(async () => {
    process.env.BOSS_RESULTS_TABLE_NAME = "test-results";
    process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME = "test-instances";
    process.env.BOSS_BATTLE_PARTICIPANTS_TABLE_NAME = "test-participants";
    process.env.BOSS_ANSWER_ATTEMPTS_TABLE_NAME = "test-attempts";
    process.env.BOSS_BATTLE_TEMPLATES_TABLE_NAME = "test-templates";
    repo = await import("../repo.ts");
});

beforeEach(() => {
    mockSend.mockReset();
    mockPutTransaction.mockReset();
    mockApplyXpAndGold.mockReset();
    mockGetPlayerState.mockReset();
});

/* ================================================================== */
/*  resultsExist                                                       */
/* ================================================================== */
describe("resultsExist", () => {
    it("returns true when META row exists", async () => {
        mockSend.mockResolvedValue({ Item: { boss_result_pk: "BI#b-1", boss_result_sk: "META" } });
        expect(await repo.resultsExist("b-1")).toBe(true);
    });

    it("returns false when META row is absent", async () => {
        mockSend.mockResolvedValue({});
        expect(await repo.resultsExist("b-1")).toBe(false);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.resultsExist("b-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  getBossResults                                                     */
/* ================================================================== */
describe("getBossResults", () => {
    it("separates guild and student rows from query result", async () => {
        mockSend.mockResolvedValue({
            Items: [
                { boss_result_sk: "GUILD#g-1", outcome: "WIN", completed_at: "2026-01-01T00:00:00Z", guild_id: "g-1" },
                { boss_result_sk: "STU#s-1", outcome: "WIN", completed_at: "2026-01-01T00:00:00Z", student_id: "s-1" },
                { boss_result_sk: "META", boss_instance_id: "b-1" },
            ],
        });

        const result = await repo.getBossResults("b-1");

        expect(result.guild_results).toHaveLength(1);
        expect(result.student_results).toHaveLength(1);
        expect(result.outcome).toBe("WIN");
        expect(result.completed_at).toBe("2026-01-01T00:00:00Z");
    });

    it("returns empty arrays when no rows", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        const result = await repo.getBossResults("b-1");
        expect(result.guild_results).toEqual([]);
        expect(result.student_results).toEqual([]);
        expect(result.outcome).toBe("ABORTED"); // default
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.getBossResults("b-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listStudentBossResults                                             */
/* ================================================================== */
describe("listStudentBossResults", () => {
    it("queries gsi1 with student_id", async () => {
        const items = [{ student_id: "s-1", boss_instance_id: "b-1" }];
        mockSend.mockResolvedValue({ Items: items });

        const result = await repo.listStudentBossResults("s-1");

        expect(result.items).toEqual(items);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.ExpressionAttributeValues[":student_id"]).toBe("s-1");
    });

    it("uses default limit of 50", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        await repo.listStudentBossResults("s-1");
        expect(mockSend.mock.calls[0][0].input.Limit).toBe(50);
    });

    it("passes custom limit", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        await repo.listStudentBossResults("s-1", { limit: 10 });
        expect(mockSend.mock.calls[0][0].input.Limit).toBe(10);
    });

    it("decodes nextToken to ExclusiveStartKey", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        const lek = { boss_result_pk: "BI#b-1", boss_result_sk: "STU#s-1" };
        const token = Buffer.from(JSON.stringify(lek)).toString("base64");

        await repo.listStudentBossResults("s-1", { nextToken: token });

        expect(mockSend.mock.calls[0][0].input.ExclusiveStartKey).toEqual(lek);
    });

    it("encodes LastEvaluatedKey as nextToken", async () => {
        const lek = { boss_result_pk: "BI#b-1" };
        mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: lek });

        const result = await repo.listStudentBossResults("s-1");
        expect(result.nextToken).toBe(Buffer.from(JSON.stringify(lek)).toString("base64"));
    });

    it("returns undefined nextToken when no more pages", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        const result = await repo.listStudentBossResults("s-1");
        expect(result.nextToken).toBeUndefined();
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.listStudentBossResults("s-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  computeAndWriteBossResults                                         */
/* ================================================================== */
describe("computeAndWriteBossResults", () => {
    const instance = {
        boss_instance_id: "battle-1",
        class_id: "class-1",
        boss_template_id: "template-1",
        status: "COMPLETED",
        outcome: "WIN",
        completed_at: "2026-01-01T00:00:00.000Z",
    };

    const template = {
        boss_template_id: "template-1",
        base_xp_reward: 100,
        base_gold_reward: 50,
    };

    const participant = {
        student_id: "stu-1",
        guild_id: "guild-1",
        state: "JOINED",
        boss_instance_id: "battle-1",
        is_downed: false,
    };

    const attempt = {
        student_id: "stu-1",
        boss_instance_id: "battle-1",
        is_correct: true,
        damage_to_boss: 10,
        hearts_delta_student: 0,
        answered_at: "2026-01-01T00:01:00.000Z",
        xp_earned: 20,
    };

    function setupSuccessMocks() {
        mockSend
            .mockResolvedValueOnce({})                           // 1. META check → not found
            .mockResolvedValueOnce({ Item: instance })           // 2. Load instance
            .mockResolvedValueOnce({ Item: template })           // 3. Load template
            .mockResolvedValueOnce({ Items: [participant] })     // 4. Load participants
            .mockResolvedValueOnce({ Items: [attempt] })         // 5. Load attempts
            .mockResolvedValue({});                              // 6+. All PutCommands

        mockGetPlayerState.mockResolvedValue({ hearts: 3 });
        mockPutTransaction.mockResolvedValue(undefined);
        mockApplyXpAndGold.mockResolvedValue(undefined);
    }

    it("returns early when results already exist (idempotent)", async () => {
        mockSend.mockResolvedValue({ Item: { boss_result_pk: "BI#battle-1", boss_result_sk: "META" } });

        const result = await repo.computeAndWriteBossResults("battle-1");

        expect(result.success).toBe(false);
        expect(result.message).toContain("already exist");
    });

    it("throws when instance not found", async () => {
        mockSend
            .mockResolvedValueOnce({})    // META check → not found
            .mockResolvedValueOnce({});   // Instance → not found

        await expect(
            repo.computeAndWriteBossResults("missing")
        ).rejects.toThrow("not found");
    });

    it("throws when instance status is not COMPLETED or ABORTED", async () => {
        mockSend
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: { ...instance, status: "LOBBY" } });

        await expect(
            repo.computeAndWriteBossResults("battle-1")
        ).rejects.toThrow("must be COMPLETED or ABORTED");
    });

    it("succeeds: writes META, student, and guild rows", async () => {
        setupSuccessMocks();

        const result = await repo.computeAndWriteBossResults("battle-1", "test");

        expect(result.success).toBe(true);

        // Verify PutCommands were sent (META + student + guild = 3 writes after 5 reads)
        // Total mockSend calls: 5 reads + 3 writes = 8
        expect(mockSend.mock.calls.length).toBeGreaterThanOrEqual(8);

        // Verify reward transaction was created
        expect(mockPutTransaction).toHaveBeenCalled();

        // Verify XP/gold applied to player state
        expect(mockApplyXpAndGold).toHaveBeenCalled();
    });

    it("returns concurrent-write message when META write gets ConditionalCheckFailedException", async () => {
        mockSend
            .mockResolvedValueOnce({})                           // META check → not found
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: template })
            .mockResolvedValueOnce({ Items: [participant] })
            .mockResolvedValueOnce({ Items: [attempt] });

        // getPlayerState, putTransaction, applyXpAndGold succeed
        mockGetPlayerState.mockResolvedValue({ hearts: 3 });
        mockPutTransaction.mockResolvedValue(undefined);
        mockApplyXpAndGold.mockResolvedValue(undefined);

        // META write fails with ConditionalCheckFailedException
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const result = await repo.computeAndWriteBossResults("battle-1");

        expect(result.success).toBe(false);
        expect(result.message).toContain("another process");
    });

    it("halves rewards for students with 0 hearts", async () => {
        mockSend
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: template })
            .mockResolvedValueOnce({ Items: [participant] })
            .mockResolvedValueOnce({ Items: [attempt] })
            .mockResolvedValue({});

        mockGetPlayerState.mockResolvedValue({ hearts: 0 }); // 0 hearts!
        mockPutTransaction.mockResolvedValue(undefined);
        mockApplyXpAndGold.mockResolvedValue(undefined);

        const result = await repo.computeAndWriteBossResults("battle-1");
        expect(result.success).toBe(true);

        // The putTransaction call should have halved XP/gold
        // With 1 guild (no rank bonus): XP = (20 attempt + 100 completion) * 0.5 = 60
        const txnCall = mockPutTransaction.mock.calls[0][0];
        expect(txnCall.xp_delta).toBeLessThan(120); // would be 120 without halving
    });
});

/**
 * Unit tests for playerStates/repo.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/playerStates
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock AWS SDK
// ---------------------------------------------------------------------------
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: vi.fn(function () { return {}; }),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(function () { return { send: mockSend }; }),
    },
    PutCommand:    vi.fn(function (input: any) { return { input }; }),
    GetCommand:    vi.fn(function (input: any) { return { input }; }),
    QueryCommand:  vi.fn(function (input: any) { return { input }; }),
    UpdateCommand: vi.fn(function (input: any) { return { input }; }),
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
let repo: typeof import("../repo.js");

beforeAll(async () => {
    process.env.PLAYER_STATES_TABLE_NAME = "test-player-states";
    repo = await import("../repo.js");
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeItem(overrides: Record<string, any> = {}) {
    return {
        class_id:        "class-1",
        student_id:      "student-1",
        current_xp:      100,
        xp_to_next_level: 500,
        total_xp_earned: 100,
        hearts:          3,
        max_hearts:      5,
        gold:            50,
        status:          "ALIVE" as const,
        ...overrides,
    };
}

function makeFullItem(overrides: Record<string, any> = {}) {
    return {
        ...makeItem(),
        leaderboard_sort: "0999999900#student-1",
        created_at:       "2024-01-01T00:00:00.000Z",
        updated_at:       "2024-01-02T00:00:00.000Z",
        ...overrides,
    };
}

function encodeCursor(key: Record<string, any>) {
    return Buffer.from(JSON.stringify(key)).toString("base64");
}

// ---------------------------------------------------------------------------
// getPlayerState
// ---------------------------------------------------------------------------
describe("getPlayerState", () => {
    it("returns PlayerStateItem when Item is present", async () => {
        const item = makeFullItem();
        mockSend.mockResolvedValueOnce({ Item: item });

        const result = await repo.getPlayerState("class-1", "student-1");

        expect(result).toEqual(item);
    });

    it("returns null when Item is undefined", async () => {
        mockSend.mockResolvedValueOnce({});

        const result = await repo.getPlayerState("class-1", "student-1");

        expect(result).toBeNull();
    });

    it("passes correct Key to GetCommand", async () => {
        mockSend.mockResolvedValueOnce({});

        await repo.getPlayerState("class-42", "student-99");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toEqual({ class_id: "class-42", student_id: "student-99" });
    });

    it("passes correct TableName to GetCommand", async () => {
        mockSend.mockResolvedValueOnce({});

        await repo.getPlayerState("class-1", "student-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-player-states");
    });
});

// ---------------------------------------------------------------------------
// upsertPlayerState
// ---------------------------------------------------------------------------
describe("upsertPlayerState", () => {
    it("makes two DDB calls: GetCommand then PutCommand", async () => {
        mockSend
            .mockResolvedValueOnce({})                     // getPlayerState → null
            .mockResolvedValueOnce({});                    // PutCommand

        await repo.upsertPlayerState(makeItem());

        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("uses existing created_at when player state already exists", async () => {
        const existing = makeFullItem({ created_at: "2023-01-01T00:00:00.000Z" });
        mockSend
            .mockResolvedValueOnce({ Item: existing })
            .mockResolvedValueOnce({});

        await repo.upsertPlayerState(makeItem());

        const putCmd = mockSend.mock.calls[1][0];
        expect(putCmd.input.Item.created_at).toBe("2023-01-01T00:00:00.000Z");
    });

    it("uses new now for created_at when player state does not exist", async () => {
        mockSend
            .mockResolvedValueOnce({})    // no Item
            .mockResolvedValueOnce({});

        const before = new Date().toISOString();
        await repo.upsertPlayerState(makeItem());
        const after = new Date().toISOString();

        const putCmd = mockSend.mock.calls[1][0];
        expect(putCmd.input.Item.created_at >= before).toBe(true);
        expect(putCmd.input.Item.created_at <= after).toBe(true);
    });

    it("computes leaderboard_sort using makeLeaderboardSort", async () => {
        mockSend
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        await repo.upsertPlayerState(makeItem({ total_xp_earned: 500, student_id: "student-1" }));

        const putCmd = mockSend.mock.calls[1][0];
        const expected = (1_000_000_000 - 500).toString().padStart(10, "0") + "#student-1";
        expect(putCmd.input.Item.leaderboard_sort).toBe(expected);
    });

    it("passes correct TableName to PutCommand", async () => {
        mockSend
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        await repo.upsertPlayerState(makeItem());

        const putCmd = mockSend.mock.calls[1][0];
        expect(putCmd.input.TableName).toBe("test-player-states");
    });

    it("sets updated_at to a recent ISO timestamp", async () => {
        mockSend
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        const before = new Date().toISOString();
        await repo.upsertPlayerState(makeItem());
        const after = new Date().toISOString();

        const putCmd = mockSend.mock.calls[1][0];
        expect(putCmd.input.Item.updated_at >= before).toBe(true);
        expect(putCmd.input.Item.updated_at <= after).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// setPlayerHearts
// ---------------------------------------------------------------------------
describe("setPlayerHearts", () => {
    it("makes one UpdateCommand call", async () => {
        mockSend.mockResolvedValueOnce({});

        await repo.setPlayerHearts("class-1", "student-1", 3);

        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("passes new_hearts as :hearts in ExpressionAttributeValues", async () => {
        mockSend.mockResolvedValueOnce({});

        await repo.setPlayerHearts("class-1", "student-1", 4);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":hearts"]).toBe(4);
    });

    it("uses attribute_exists(class_id) ConditionExpression", async () => {
        mockSend.mockResolvedValueOnce({});

        await repo.setPlayerHearts("class-1", "student-1", 3);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(class_id)");
    });

    it("passes correct Key to UpdateCommand", async () => {
        mockSend.mockResolvedValueOnce({});

        await repo.setPlayerHearts("class-42", "student-99", 2);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toEqual({ class_id: "class-42", student_id: "student-99" });
    });

    it("passes correct TableName", async () => {
        mockSend.mockResolvedValueOnce({});

        await repo.setPlayerHearts("class-1", "student-1", 3);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-player-states");
    });
});

// ---------------------------------------------------------------------------
// applyXpAndGold
// ---------------------------------------------------------------------------
describe("applyXpAndGold", () => {
    it("returns immediately without DDB calls when both deltas are 0", async () => {
        await repo.applyXpAndGold("class-1", "student-1", 0, 0);

        expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns without UpdateCommand when getPlayerState returns null", async () => {
        mockSend.mockResolvedValueOnce({});  // GetCommand → no Item

        await repo.applyXpAndGold("class-1", "student-1", 10, 0);

        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("makes GetCommand then UpdateCommand when player exists and deltas are non-zero", async () => {
        const existing = makeFullItem({ total_xp_earned: 100, current_xp: 100, gold: 50 });
        mockSend
            .mockResolvedValueOnce({ Item: existing })
            .mockResolvedValueOnce({});

        await repo.applyXpAndGold("class-1", "student-1", 50, 10);

        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("computes correct new_total_xp in UpdateCommand", async () => {
        const existing = makeFullItem({ total_xp_earned: 100, current_xp: 100, gold: 50 });
        mockSend
            .mockResolvedValueOnce({ Item: existing })
            .mockResolvedValueOnce({});

        await repo.applyXpAndGold("class-1", "student-1", 50, 0);

        const updateCmd = mockSend.mock.calls[1][0];
        expect(updateCmd.input.ExpressionAttributeValues[":txp"]).toBe(150);
    });

    it("computes correct new_current_xp in UpdateCommand", async () => {
        const existing = makeFullItem({ total_xp_earned: 100, current_xp: 80, gold: 50 });
        mockSend
            .mockResolvedValueOnce({ Item: existing })
            .mockResolvedValueOnce({});

        await repo.applyXpAndGold("class-1", "student-1", 20, 0);

        const updateCmd = mockSend.mock.calls[1][0];
        expect(updateCmd.input.ExpressionAttributeValues[":cxp"]).toBe(100);
    });

    it("computes correct new_gold in UpdateCommand", async () => {
        const existing = makeFullItem({ total_xp_earned: 100, current_xp: 100, gold: 50 });
        mockSend
            .mockResolvedValueOnce({ Item: existing })
            .mockResolvedValueOnce({});

        await repo.applyXpAndGold("class-1", "student-1", 0, 25);

        const updateCmd = mockSend.mock.calls[1][0];
        expect(updateCmd.input.ExpressionAttributeValues[":gold"]).toBe(75);
    });

    it("uses attribute_exists(class_id) ConditionExpression", async () => {
        const existing = makeFullItem();
        mockSend
            .mockResolvedValueOnce({ Item: existing })
            .mockResolvedValueOnce({});

        await repo.applyXpAndGold("class-1", "student-1", 10, 0);

        const updateCmd = mockSend.mock.calls[1][0];
        expect(updateCmd.input.ConditionExpression).toBe("attribute_exists(class_id)");
    });

    it("updates leaderboard_sort in UpdateCommand", async () => {
        const existing = makeFullItem({ total_xp_earned: 100, current_xp: 100, gold: 0, student_id: "student-1" });
        mockSend
            .mockResolvedValueOnce({ Item: existing })
            .mockResolvedValueOnce({});

        await repo.applyXpAndGold("class-1", "student-1", 50, 0);

        const updateCmd = mockSend.mock.calls[1][0];
        const expected = (1_000_000_000 - 150).toString().padStart(10, "0") + "#student-1";
        expect(updateCmd.input.ExpressionAttributeValues[":ls"]).toBe(expected);
    });
});

// ---------------------------------------------------------------------------
// listLeaderboard
// ---------------------------------------------------------------------------
describe("listLeaderboard", () => {
    it("returns items from QueryCommand result", async () => {
        const items = [makeFullItem()];
        mockSend.mockResolvedValueOnce({ Items: items });

        const result = await repo.listLeaderboard("class-1");

        expect(result.items).toEqual(items);
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValueOnce({});

        const result = await repo.listLeaderboard("class-1");

        expect(result.items).toEqual([]);
    });

    it("returns nextCursor when LastEvaluatedKey is present", async () => {
        const lek = { class_id: "class-1", student_id: "s-1", leaderboard_sort: "0999999900#s-1" };
        mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: lek });

        const result = await repo.listLeaderboard("class-1");

        expect(result.nextCursor).toBe(encodeCursor(lek));
    });

    it("returns undefined nextCursor when LastEvaluatedKey is absent", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        const result = await repo.listLeaderboard("class-1");

        expect(result.nextCursor).toBeUndefined();
    });

    it("clamps limit > 100 to 100", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.listLeaderboard("class-1", 999);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(100);
    });

    it("clamps limit < 1 to 1", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.listLeaderboard("class-1", 0);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(1);
    });

    it("uses default limit of 50 when not specified", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.listLeaderboard("class-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Limit).toBe(50);
    });

    it("uses ScanIndexForward: true for ASC leaderboard_sort order", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.listLeaderboard("class-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ScanIndexForward).toBe(true);
    });

    it("queries gsi1 index", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.listLeaderboard("class-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi1");
    });

    it("decodes valid base64 cursor into ExclusiveStartKey", async () => {
        const lek = { class_id: "class-1", student_id: "s-1" };
        const cursor = encodeCursor(lek);
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.listLeaderboard("class-1", 50, cursor);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExclusiveStartKey).toEqual(lek);
    });

    it("throws 'Invalid cursor format' for malformed cursor", async () => {
        await expect(repo.listLeaderboard("class-1", 50, "!!!not-valid-base64!!!")).rejects.toThrow("Invalid cursor format");
    });

    it("passes correct class_id in KeyConditionExpression values", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await repo.listLeaderboard("class-xyz");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":cid"]).toBe("class-xyz");
    });
});

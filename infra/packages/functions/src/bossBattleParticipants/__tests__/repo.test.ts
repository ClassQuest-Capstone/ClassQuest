/**
 * Unit tests for bossBattleParticipants/repo.ts
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
    process.env.BOSS_BATTLE_PARTICIPANTS_TABLE_NAME = "test-boss-battle-participants";
    repoModule = await import("../repo.ts");
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeParticipant(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id: "inst-1",
        student_id:       "student-1",
        class_id:         "class-1",
        guild_id:         "guild-1",
        state:            "JOINED",
        joined_at:        "2026-04-09T10:00:00.000Z",
        updated_at:       "2026-04-09T10:00:00.000Z",
        is_downed:        false,
        gsi2_sk:          "inst-1#student-1",
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// getParticipant
// ---------------------------------------------------------------------------
describe("getParticipant", () => {
    it("queries main table with boss_instance_id + student_id key", async () => {
        mockSend.mockResolvedValue({ Item: makeParticipant() });

        await repoModule.getParticipant("inst-1", "student-1");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.TableName).toBe("test-boss-battle-participants");
        expect(cmd.input.Key).toEqual({
            boss_instance_id: "inst-1",
            student_id:       "student-1",
        });
    });

    it("returns participant item when found", async () => {
        const item = makeParticipant();
        mockSend.mockResolvedValue({ Item: item });

        const result = await repoModule.getParticipant("inst-1", "student-1");

        expect(result).not.toBeNull();
        expect(result!.student_id).toBe("student-1");
        expect(result!.state).toBe("JOINED");
    });

    it("returns null when participant not found", async () => {
        mockSend.mockResolvedValue({ Item: undefined });

        const result = await repoModule.getParticipant("inst-1", "student-1");

        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// upsertParticipantJoin
// ---------------------------------------------------------------------------
describe("upsertParticipantJoin", () => {
    const joinInput = {
        boss_instance_id: "inst-1",
        student_id:       "student-1",
        class_id:         "class-1",
        guild_id:         "guild-1",
    };

    it("creates a new JOINED participant when none exists", async () => {
        // getParticipant → null, then PutCommand
        mockSend
            .mockResolvedValueOnce({ Item: undefined })
            .mockResolvedValueOnce({});

        const result = await repoModule.upsertParticipantJoin(joinInput);

        expect(mockSend).toHaveBeenCalledTimes(2);
        expect(result.state).toBe("JOINED");
        expect(result.is_downed).toBe(false);
        expect(result.boss_instance_id).toBe("inst-1");
        expect(result.student_id).toBe("student-1");
    });

    it("writes the correct item to DynamoDB with PutCommand", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: undefined })
            .mockResolvedValueOnce({});

        await repoModule.upsertParticipantJoin(joinInput);

        // Second call is PutCommand
        const [putCmd] = mockSend.mock.calls[1];
        const item = putCmd.input.Item;
        expect(item.boss_instance_id).toBe("inst-1");
        expect(item.student_id).toBe("student-1");
        expect(item.class_id).toBe("class-1");
        expect(item.guild_id).toBe("guild-1");
        expect(item.state).toBe("JOINED");
        expect(item.is_downed).toBe(false);
        expect(item.gsi2_sk).toBe("inst-1#student-1");
    });

    it("preserves joined_at from existing record on rejoin", async () => {
        const existing = makeParticipant({
            joined_at: "2026-04-01T08:00:00.000Z",
            state:     "LEFT",
        });
        mockSend
            .mockResolvedValueOnce({ Item: existing })
            .mockResolvedValueOnce({});

        const result = await repoModule.upsertParticipantJoin(joinInput);

        expect(result.joined_at).toBe("2026-04-01T08:00:00.000Z");
    });

    it("sets joined_at to now when no existing record", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: undefined })
            .mockResolvedValueOnce({});

        const before = new Date().toISOString();
        const result = await repoModule.upsertParticipantJoin(joinInput);
        const after = new Date().toISOString();

        expect(result.joined_at >= before).toBe(true);
        expect(result.joined_at <= after).toBe(true);
    });

    it("throws when existing participant state is KICKED", async () => {
        const kicked = makeParticipant({ state: "KICKED" });
        mockSend.mockResolvedValueOnce({ Item: kicked });

        await expect(repoModule.upsertParticipantJoin(joinInput))
            .rejects.toThrow("kicked");

        // PutCommand should NOT have been called
        expect(mockSend).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// setParticipantSpectate
// ---------------------------------------------------------------------------
describe("setParticipantSpectate", () => {
    it("sends UpdateCommand with state=SPECTATE", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.setParticipantSpectate("inst-1", "student-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;
        expect(params.TableName).toBe("test-boss-battle-participants");
        expect(params.Key).toEqual({ boss_instance_id: "inst-1", student_id: "student-1" });
        expect(params.ExpressionAttributeValues[":spectate"]).toBe("SPECTATE");
        expect(params.UpdateExpression).toContain("#state");
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("ConditionalCheckFailedException"));
        await expect(repoModule.setParticipantSpectate("inst-1", "student-1"))
            .rejects.toThrow("ConditionalCheckFailedException");
    });
});

// ---------------------------------------------------------------------------
// setParticipantLeft
// ---------------------------------------------------------------------------
describe("setParticipantLeft", () => {
    it("sends UpdateCommand with state=LEFT", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.setParticipantLeft("inst-1", "student-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;
        expect(params.ExpressionAttributeValues[":left"]).toBe("LEFT");
        expect(params.Key).toEqual({ boss_instance_id: "inst-1", student_id: "student-1" });
    });
});

// ---------------------------------------------------------------------------
// kickParticipant
// ---------------------------------------------------------------------------
describe("kickParticipant", () => {
    it("sends UpdateCommand with state=KICKED (no reason)", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.kickParticipant("inst-1", "student-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;
        expect(params.ExpressionAttributeValues[":kicked"]).toBe("KICKED");
        expect(params.ExpressionAttributeValues[":reason"]).toBeUndefined();
        expect(params.UpdateExpression).not.toContain("kick_reason");
    });

    it("includes kick_reason in UpdateExpression when reason is provided", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.kickParticipant("inst-1", "student-1", "cheating");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;
        expect(params.ExpressionAttributeValues[":reason"]).toBe("cheating");
        expect(params.UpdateExpression).toContain("kick_reason");
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("ServiceUnavailable"));
        await expect(repoModule.kickParticipant("inst-1", "student-1"))
            .rejects.toThrow("ServiceUnavailable");
    });
});

// ---------------------------------------------------------------------------
// markParticipantDowned
// ---------------------------------------------------------------------------
describe("markParticipantDowned", () => {
    it("sends UpdateCommand setting is_downed=true and downed_at", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.markParticipantDowned("inst-1", "student-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;
        expect(params.ExpressionAttributeValues[":true"]).toBe(true);
        expect(params.UpdateExpression).toContain("is_downed");
        expect(params.UpdateExpression).toContain("downed_at");
        expect(params.Key).toEqual({ boss_instance_id: "inst-1", student_id: "student-1" });
    });
});

// ---------------------------------------------------------------------------
// updateAntiSpamFields
// ---------------------------------------------------------------------------
describe("updateAntiSpamFields", () => {
    it("updates last_submit_at when provided", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.updateAntiSpamFields("inst-1", "student-1", {
            last_submit_at: "2026-04-09T10:05:00.000Z",
        });

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;
        expect(params.ExpressionAttributeValues[":last_submit_at"]).toBe("2026-04-09T10:05:00.000Z");
        expect(params.UpdateExpression).toContain("last_submit_at");
    });

    it("updates frozen_until when provided", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.updateAntiSpamFields("inst-1", "student-1", {
            frozen_until: "2026-04-09T10:10:00.000Z",
        });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExpressionAttributeValues[":frozen_until"]).toBe("2026-04-09T10:10:00.000Z");
        expect(cmd.input.UpdateExpression).toContain("frozen_until");
    });

    it("updates both fields when both provided", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.updateAntiSpamFields("inst-1", "student-1", {
            last_submit_at: "2026-04-09T10:05:00.000Z",
            frozen_until:   "2026-04-09T10:10:00.000Z",
        });

        const [cmd] = mockSend.mock.calls[0];
        const expr = cmd.input.UpdateExpression;
        expect(expr).toContain("last_submit_at");
        expect(expr).toContain("frozen_until");
    });

    it("only updates updated_at when no optional fields provided", async () => {
        mockSend.mockResolvedValue({});

        await repoModule.updateAntiSpamFields("inst-1", "student-1", {});

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.UpdateExpression).toContain("updated_at");
        expect(cmd.input.UpdateExpression).not.toContain("last_submit_at");
        expect(cmd.input.UpdateExpression).not.toContain("frozen_until");
    });
});

// ---------------------------------------------------------------------------
// listParticipants
// ---------------------------------------------------------------------------
describe("listParticipants", () => {
    it("queries main table with boss_instance_id key condition", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listParticipants("inst-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;
        expect(params.TableName).toBe("test-boss-battle-participants");
        expect(params.ExpressionAttributeValues[":boss_instance_id"]).toBe("inst-1");
        expect(params.FilterExpression).toBeUndefined();
    });

    it("adds FilterExpression when state filter is provided", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listParticipants("inst-1", { state: "JOINED" as any });

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;
        expect(params.FilterExpression).toContain("#state");
        expect(params.ExpressionAttributeValues[":state"]).toBe("JOINED");
    });

    it("returns list of participants", async () => {
        const items = [makeParticipant(), makeParticipant({ student_id: "student-2" })];
        mockSend.mockResolvedValue({ Items: items });

        const result = await repoModule.listParticipants("inst-1");

        expect(result).toHaveLength(2);
        expect(result[0].student_id).toBe("student-1");
    });

    it("returns empty array when no participants", async () => {
        mockSend.mockResolvedValue({ Items: undefined });

        const result = await repoModule.listParticipants("inst-1");

        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// listParticipantsByClass
// ---------------------------------------------------------------------------
describe("listParticipantsByClass", () => {
    it("queries GSI2 with class_id", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listParticipantsByClass("class-1");

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;
        expect(params.IndexName).toBe("gsi2");
        expect(params.ExpressionAttributeValues[":class_id"]).toBe("class-1");
    });

    it("returns empty array when no participants in class", async () => {
        mockSend.mockResolvedValue({ Items: undefined });

        const result = await repoModule.listParticipantsByClass("class-1");

        expect(result).toEqual([]);
    });
});

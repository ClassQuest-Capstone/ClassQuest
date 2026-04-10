/**
 * Unit tests for bossBattleSnapshots/repo.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/bossBattleSnapshots
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
// Module reference — set env vars BEFORE dynamic import
// ---------------------------------------------------------------------------
let repoModule: typeof import("../repo.ts");

beforeAll(async () => {
    process.env.BOSS_BATTLE_SNAPSHOTS_TABLE_NAME     = "test-snapshots";
    process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME     = "test-instances";
    process.env.BOSS_BATTLE_PARTICIPANTS_TABLE_NAME  = "test-participants";
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
        boss_instance_id: "inst-1",
        status:           "LOBBY",
        class_id:         "class-1",
        ...overrides,
    };
}

function makeParticipantItem(studentId: string, guildId: string) {
    return { student_id: studentId, guild_id: guildId, state: "JOINED" };
}

function makeSnapshot(overrides: Record<string, any> = {}) {
    return {
        snapshot_id:            "snap-1",
        boss_instance_id:       "inst-1",
        class_id:               "class-1",
        created_by_teacher_id:  "teacher-1",
        created_at:             "2026-04-09T10:00:00.000Z",
        joined_students:        [{ student_id: "s-1", guild_id: "guild-A" }],
        joined_count:           1,
        guild_counts:           { "guild-A": 1 },
        version:                1,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// getSnapshot
// ---------------------------------------------------------------------------
describe("getSnapshot", () => {
    it("sends GetCommand with correct TableName and Key", async () => {
        mockSend.mockResolvedValue({ Item: makeSnapshot() });

        await repoModule.getSnapshot("snap-1");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.TableName).toBe("test-snapshots");
        expect(cmd.input.Key).toEqual({ snapshot_id: "snap-1" });
    });

    it("returns snapshot when found", async () => {
        const snap = makeSnapshot();
        mockSend.mockResolvedValue({ Item: snap });

        const result = await repoModule.getSnapshot("snap-1");

        expect(result).not.toBeNull();
        expect(result!.snapshot_id).toBe("snap-1");
        expect(result!.boss_instance_id).toBe("inst-1");
        expect(result!.joined_count).toBe(1);
    });

    it("returns null when snapshot not found", async () => {
        mockSend.mockResolvedValue({ Item: undefined });

        const result = await repoModule.getSnapshot("missing");

        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// listSnapshotsByInstance
// ---------------------------------------------------------------------------
describe("listSnapshotsByInstance", () => {
    it("queries gsi1 with boss_instance_id and default Limit 50", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listSnapshotsByInstance("inst-1");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.TableName).toBe("test-snapshots");
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.ExpressionAttributeValues[":boss_instance_id"]).toBe("inst-1");
        expect(cmd.input.Limit).toBe(50);
    });

    it("uses custom limit when provided", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        await repoModule.listSnapshotsByInstance("inst-1", { limit: 10 });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Limit).toBe(10);
    });

    it("decodes nextToken into ExclusiveStartKey", async () => {
        mockSend.mockResolvedValue({ Items: [] });

        const key = { snapshot_id: "snap-1", boss_instance_id: "inst-1" };
        const token = Buffer.from(JSON.stringify(key)).toString("base64");

        await repoModule.listSnapshotsByInstance("inst-1", { nextToken: token });

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExclusiveStartKey).toEqual(key);
    });

    it("encodes LastEvaluatedKey as nextToken in response", async () => {
        const lek = { snapshot_id: "snap-1", boss_instance_id: "inst-1" };
        mockSend.mockResolvedValue({ Items: [makeSnapshot()], LastEvaluatedKey: lek });

        const result = await repoModule.listSnapshotsByInstance("inst-1");

        expect(result.nextToken).toBe(Buffer.from(JSON.stringify(lek)).toString("base64"));
    });

    it("returns undefined nextToken when no more pages", async () => {
        mockSend.mockResolvedValue({ Items: [makeSnapshot()] });

        const result = await repoModule.listSnapshotsByInstance("inst-1");

        expect(result.nextToken).toBeUndefined();
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValue({ Items: undefined });

        const result = await repoModule.listSnapshotsByInstance("inst-1");

        expect(result.items).toEqual([]);
    });

    it("returns items when present", async () => {
        mockSend.mockResolvedValue({ Items: [makeSnapshot(), makeSnapshot({ snapshot_id: "snap-2" })] });

        const result = await repoModule.listSnapshotsByInstance("inst-1");

        expect(result.items).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// createParticipantsSnapshot — guard cases
// ---------------------------------------------------------------------------
describe("createParticipantsSnapshot — guards", () => {
    const input = { boss_instance_id: "inst-1", created_by_teacher_id: "teacher-1" };

    it("throws when instance is not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });

        await expect(repoModule.createParticipantsSnapshot(input))
            .rejects.toThrow("not found");

        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("throws when instance status is not LOBBY or COUNTDOWN", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeInstance({ status: "QUESTION_ACTIVE" }) });

        await expect(repoModule.createParticipantsSnapshot(input))
            .rejects.toThrow("QUESTION_ACTIVE");

        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("accepts LOBBY status", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ status: "LOBBY" }) })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        await expect(repoModule.createParticipantsSnapshot(input)).resolves.toBeDefined();
    });

    it("accepts COUNTDOWN status", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance({ status: "COUNTDOWN" }) })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        await expect(repoModule.createParticipantsSnapshot(input)).resolves.toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// createParticipantsSnapshot — DynamoDB call sequence
// ---------------------------------------------------------------------------
describe("createParticipantsSnapshot — call sequence", () => {
    const input = { boss_instance_id: "inst-1", created_by_teacher_id: "teacher-1" };

    function setupMocks(participants: any[] = []) {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })           // call 0: GetCommand instance
            .mockResolvedValueOnce({ Items: participants })             // call 1: QueryCommand participants
            .mockResolvedValueOnce({})                                  // call 2: PutCommand snapshot
            .mockResolvedValueOnce({});                                 // call 3: UpdateCommand instance
    }

    it("queries participants table for JOINED state", async () => {
        setupMocks([makeParticipantItem("s-1", "guild-A")]);

        await repoModule.createParticipantsSnapshot(input);

        const queryCmd = mockSend.mock.calls[1][0];
        expect(queryCmd.input.TableName).toBe("test-participants");
        expect(queryCmd.input.ExpressionAttributeValues[":boss_instance_id"]).toBe("inst-1");
        expect(queryCmd.input.ExpressionAttributeValues[":joined"]).toBe("JOINED");
        expect(queryCmd.input.FilterExpression).toContain("#state");
    });

    it("writes PutCommand to snapshots table with correct item", async () => {
        setupMocks([makeParticipantItem("s-1", "guild-A")]);

        const result = await repoModule.createParticipantsSnapshot(input);

        const putCmd = mockSend.mock.calls[2][0];
        expect(putCmd.input.TableName).toBe("test-snapshots");
        expect(putCmd.input.Item.boss_instance_id).toBe("inst-1");
        expect(putCmd.input.Item.class_id).toBe("class-1");
        expect(putCmd.input.Item.created_by_teacher_id).toBe("teacher-1");
        expect(putCmd.input.Item.version).toBe(1);
        expect(putCmd.input.Item.snapshot_id).toBeTruthy();
    });

    it("sends UpdateCommand to instances table with snapshot_id", async () => {
        setupMocks([makeParticipantItem("s-1", "guild-A")]);

        const result = await repoModule.createParticipantsSnapshot(input);

        const updateCmd = mockSend.mock.calls[3][0];
        expect(updateCmd.input.TableName).toBe("test-instances");
        expect(updateCmd.input.Key).toEqual({ boss_instance_id: "inst-1" });
        expect(updateCmd.input.ExpressionAttributeValues[":snapshot_id"]).toBe(result.snapshot_id);
        expect(updateCmd.input.ConditionExpression).toContain("attribute_not_exists");
    });

    it("makes exactly 4 DynamoDB calls for happy path", async () => {
        setupMocks([makeParticipantItem("s-1", "guild-A")]);

        await repoModule.createParticipantsSnapshot(input);

        expect(mockSend).toHaveBeenCalledTimes(4);
    });
});

// ---------------------------------------------------------------------------
// createParticipantsSnapshot — result shape and guild computation
// ---------------------------------------------------------------------------
describe("createParticipantsSnapshot — result shape", () => {
    const input = { boss_instance_id: "inst-1", created_by_teacher_id: "teacher-1" };

    it("computes guild_counts correctly for multiple guilds", async () => {
        const participants = [
            makeParticipantItem("s-1", "guild-A"),
            makeParticipantItem("s-2", "guild-A"),
            makeParticipantItem("s-3", "guild-B"),
        ];
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        const result = await repoModule.createParticipantsSnapshot(input);

        expect(result.guild_counts["guild-A"]).toBe(2);
        expect(result.guild_counts["guild-B"]).toBe(1);
        expect(result.joined_count).toBe(3);
    });

    it("returns empty guild_counts and zero joined_count when no participants", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        const result = await repoModule.createParticipantsSnapshot(input);

        expect(result.joined_count).toBe(0);
        expect(result.guild_counts).toEqual({});
        expect(result.joined_students).toEqual([]);
    });

    it("maps participants to joined_students with student_id and guild_id only", async () => {
        const participants = [makeParticipantItem("s-1", "guild-A")];
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Items: participants })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        const result = await repoModule.createParticipantsSnapshot(input);

        expect(result.joined_students[0]).toEqual({
            student_id: "s-1",
            guild_id:   "guild-A",
        });
    });

    it("returns snapshot with a generated snapshot_id", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Items: [makeParticipantItem("s-1", "guild-A")] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({});

        const result = await repoModule.createParticipantsSnapshot(input);

        expect(typeof result.snapshot_id).toBe("string");
        expect(result.snapshot_id.length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// createParticipantsSnapshot — error handling
// ---------------------------------------------------------------------------
describe("createParticipantsSnapshot — error handling", () => {
    const input = { boss_instance_id: "inst-1", created_by_teacher_id: "teacher-1" };

    it("throws 'already exists' when ConditionalCheckFailedException on UpdateCommand", async () => {
        const err = new Error("ConditionalCheckFailed");
        err.name = "ConditionalCheckFailedException";

        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(err);

        await expect(repoModule.createParticipantsSnapshot(input))
            .rejects.toThrow("already exists");
    });

    it("re-throws non-conditional DynamoDB errors from UpdateCommand", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(new Error("ServiceUnavailable"));

        await expect(repoModule.createParticipantsSnapshot(input))
            .rejects.toThrow("ServiceUnavailable");
    });

    it("propagates DynamoDB errors from QueryCommand", async () => {
        mockSend
            .mockResolvedValueOnce({ Item: makeInstance() })
            .mockRejectedValueOnce(new Error("QueryFailed"));

        await expect(repoModule.createParticipantsSnapshot(input))
            .rejects.toThrow("QueryFailed");
    });
});

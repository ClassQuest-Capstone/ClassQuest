/**
 * Unit tests for bossBattleParticipants handlers:
 *   join.ts, kick.ts, leave.ts, list.ts, spectate.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DynamoDB — needed by join.ts which fetches the boss instance directly
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
// Mock repo functions — handlers call these after their own validation
// ---------------------------------------------------------------------------
const mockUpsertParticipantJoin  = vi.fn();
const mockSetParticipantSpectate = vi.fn();
const mockSetParticipantLeft     = vi.fn();
const mockKickParticipant        = vi.fn();
const mockListParticipants       = vi.fn();

vi.mock("../repo.ts", () => ({
    upsertParticipantJoin:  (...a: any[]) => mockUpsertParticipantJoin(...a),
    setParticipantSpectate: (...a: any[]) => mockSetParticipantSpectate(...a),
    setParticipantLeft:     (...a: any[]) => mockSetParticipantLeft(...a),
    kickParticipant:        (...a: any[]) => mockKickParticipant(...a),
    listParticipants:       (...a: any[]) => mockListParticipants(...a),
}));

// ---------------------------------------------------------------------------
// Module references
// ---------------------------------------------------------------------------
let joinHandler:     (typeof import("../join.ts"))["handler"];
let kickHandler:     (typeof import("../kick.ts"))["handler"];
let leaveHandler:    (typeof import("../leave.ts"))["handler"];
let listHandler:     (typeof import("../list.ts"))["handler"];
let spectateHandler: (typeof import("../spectate.ts"))["handler"];

beforeAll(async () => {
    process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME    = "test-boss-instances";
    process.env.BOSS_BATTLE_PARTICIPANTS_TABLE_NAME = "test-boss-participants";

    joinHandler     = (await import("../join.ts")).handler;
    kickHandler     = (await import("../kick.ts")).handler;
    leaveHandler    = (await import("../leave.ts")).handler;
    listHandler     = (await import("../list.ts")).handler;
    spectateHandler = (await import("../spectate.ts")).handler;
});

beforeEach(() => {
    mockSend.mockReset();
    mockUpsertParticipantJoin.mockReset();
    mockSetParticipantSpectate.mockReset();
    mockSetParticipantLeft.mockReset();
    mockKickParticipant.mockReset();
    mockListParticipants.mockReset();

    // Default: repo calls resolve void
    mockUpsertParticipantJoin.mockResolvedValue(makeParticipant());
    mockSetParticipantSpectate.mockResolvedValue(undefined);
    mockSetParticipantLeft.mockResolvedValue(undefined);
    mockKickParticipant.mockResolvedValue(undefined);
    mockListParticipants.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeParticipant(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id: "inst-1",
        student_id:       "student-sub-1",
        class_id:         "class-1",
        guild_id:         "guild-1",
        state:            "JOINED",
        joined_at:        "2026-04-09T10:00:00.000Z",
        updated_at:       "2026-04-09T10:00:00.000Z",
        is_downed:        false,
        gsi2_sk:          "inst-1#student-sub-1",
        ...overrides,
    };
}

function makeInstance(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id:   "inst-1",
        class_id:           "class-1",
        status:             "LOBBY",
        late_join_policy:   "DISALLOW_AFTER_COUNTDOWN",
        ...overrides,
    };
}

function makeJoinEvent(overrides: {
    bossInstanceId?: string | null;
    sub?: string | null;
    guildId?: string | null;
} = {}) {
    const { bossInstanceId = "inst-1", sub = "student-sub-1", guildId = "guild-1" } = overrides;
    return {
        pathParameters:  bossInstanceId != null ? { boss_instance_id: bossInstanceId } : undefined,
        requestContext:  sub != null
            ? { authorizer: { jwt: { claims: { sub } } } }
            : {},
        body: guildId != null ? JSON.stringify({ guild_id: guildId }) : "{}",
    };
}

function makeKickEvent(overrides: {
    bossInstanceId?: string | null;
    studentId?: string | null;
    reason?: string;
} = {}) {
    const { bossInstanceId = "inst-1", studentId = "student-1", reason } = overrides;
    return {
        pathParameters: {
            ...(bossInstanceId != null ? { boss_instance_id: bossInstanceId } : {}),
            ...(studentId != null     ? { student_id: studentId }             : {}),
        },
        body: reason ? JSON.stringify({ reason }) : "{}",
    };
}

function makeSimpleEvent(bossInstanceId: string | null, sub: string | null = "student-sub-1") {
    return {
        pathParameters: bossInstanceId != null ? { boss_instance_id: bossInstanceId } : undefined,
        requestContext:  sub != null
            ? { authorizer: { jwt: { claims: { sub } } } }
            : {},
    };
}

function makeListEvent(bossInstanceId: string | null, stateFilter?: string) {
    return {
        pathParameters: bossInstanceId != null ? { boss_instance_id: bossInstanceId } : undefined,
        queryStringParameters: stateFilter ? { state: stateFilter } : undefined,
    };
}

// ---------------------------------------------------------------------------
// join handler
// ---------------------------------------------------------------------------
describe("join handler", () => {
    it("returns 400 when boss_instance_id is missing", async () => {
        const res = await joinHandler(makeJoinEvent({ bossInstanceId: null }));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("boss_instance_id");
        expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns 401 when JWT sub is missing", async () => {
        const res = await joinHandler(makeJoinEvent({ sub: null }));

        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body).error).toContain("Unauthorized");
    });

    it("returns 400 when guild_id is missing from body", async () => {
        const res = await joinHandler(makeJoinEvent({ guildId: null }));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("guild_id");
    });

    it("returns 404 when boss instance is not found in DynamoDB", async () => {
        mockSend.mockResolvedValue({ Item: undefined });

        const res = await joinHandler(makeJoinEvent());

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toContain("not found");
    });

    it("returns 200 and calls upsertParticipantJoin when status is LOBBY", async () => {
        mockSend.mockResolvedValue({ Item: makeInstance({ status: "LOBBY" }) });

        const res = await joinHandler(makeJoinEvent());

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.message).toContain("joined");
        expect(body.state).toBe("JOINED");
        expect(mockUpsertParticipantJoin).toHaveBeenCalledOnce();
        expect(mockUpsertParticipantJoin).toHaveBeenCalledWith(
            expect.objectContaining({
                boss_instance_id: "inst-1",
                student_id:       "student-sub-1",
                guild_id:         "guild-1",
            })
        );
    });

    it("returns 400 when status is COUNTDOWN and late_join_policy disallows", async () => {
        mockSend.mockResolvedValue({
            Item: makeInstance({ status: "COUNTDOWN", late_join_policy: "DISALLOW_AFTER_COUNTDOWN" }),
        });

        const res = await joinHandler(makeJoinEvent());

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("countdown");
        expect(mockUpsertParticipantJoin).not.toHaveBeenCalled();
    });

    it("returns 200 as SPECTATE when status is COUNTDOWN and ALLOW_SPECTATE policy", async () => {
        mockSend.mockResolvedValue({
            Item: makeInstance({ status: "COUNTDOWN", late_join_policy: "ALLOW_SPECTATE" }),
        });

        const res = await joinHandler(makeJoinEvent());

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.state).toBe("SPECTATE");
        expect(body.message).toContain("spectator");
        expect(mockUpsertParticipantJoin).toHaveBeenCalledOnce();
        expect(mockSetParticipantSpectate).toHaveBeenCalledOnce();
    });

    it("returns 400 for each active-battle status with ALLOW_SPECTATE_NEVER policy", async () => {
        for (const status of ["QUESTION_ACTIVE", "RESOLVING", "INTERMISSION"]) {
            mockSend.mockResolvedValue({
                Item: makeInstance({ status, late_join_policy: "DISALLOW_AFTER_COUNTDOWN" }),
            });
            const res = await joinHandler(makeJoinEvent());
            expect(res.statusCode).toBe(400);
            mockSend.mockReset();
        }
    });

    it("returns 400 when status is COMPLETED", async () => {
        mockSend.mockResolvedValue({ Item: makeInstance({ status: "COMPLETED" }) });

        const res = await joinHandler(makeJoinEvent());

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("completed");
    });

    it("returns 400 when status is ABORTED", async () => {
        mockSend.mockResolvedValue({ Item: makeInstance({ status: "ABORTED" }) });

        const res = await joinHandler(makeJoinEvent());

        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when status is DRAFT", async () => {
        mockSend.mockResolvedValue({ Item: makeInstance({ status: "DRAFT" }) });

        const res = await joinHandler(makeJoinEvent());

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("DRAFT");
    });

    it("returns 500 when upsertParticipantJoin throws", async () => {
        mockSend.mockResolvedValue({ Item: makeInstance({ status: "LOBBY" }) });
        mockUpsertParticipantJoin.mockRejectedValue(new Error("DynamoDB unavailable"));

        const res = await joinHandler(makeJoinEvent());

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("DynamoDB unavailable");
    });
});

// ---------------------------------------------------------------------------
// kick handler
// ---------------------------------------------------------------------------
describe("kick handler", () => {
    it("returns 400 when boss_instance_id is missing", async () => {
        const res = await kickHandler(makeKickEvent({ bossInstanceId: null }));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("boss_instance_id");
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await kickHandler(makeKickEvent({ studentId: null }));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("student_id");
    });

    it("returns 200 and calls kickParticipant on success", async () => {
        const res = await kickHandler(makeKickEvent());

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).message).toContain("kicked");
        expect(mockKickParticipant).toHaveBeenCalledWith("inst-1", "student-1", undefined);
    });

    it("passes reason to kickParticipant when provided in body", async () => {
        const res = await kickHandler(makeKickEvent({ reason: "disruptive behaviour" }));

        expect(res.statusCode).toBe(200);
        expect(mockKickParticipant).toHaveBeenCalledWith("inst-1", "student-1", "disruptive behaviour");
    });

    it("returns 500 when kickParticipant throws", async () => {
        mockKickParticipant.mockRejectedValue(new Error("ServiceUnavailable"));

        const res = await kickHandler(makeKickEvent());

        expect(res.statusCode).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// leave handler
// ---------------------------------------------------------------------------
describe("leave handler", () => {
    it("returns 400 when boss_instance_id is missing", async () => {
        const res = await leaveHandler(makeSimpleEvent(null));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("boss_instance_id");
    });

    it("returns 401 when JWT sub is missing", async () => {
        const res = await leaveHandler(makeSimpleEvent("inst-1", null));

        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body).error).toContain("Unauthorized");
    });

    it("returns 200 and calls setParticipantLeft on success", async () => {
        const res = await leaveHandler(makeSimpleEvent("inst-1"));

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).message).toContain("left");
        expect(mockSetParticipantLeft).toHaveBeenCalledWith("inst-1", "student-sub-1");
    });

    it("returns 500 when setParticipantLeft throws", async () => {
        mockSetParticipantLeft.mockRejectedValue(new Error("DB error"));

        const res = await leaveHandler(makeSimpleEvent("inst-1"));

        expect(res.statusCode).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// list handler
// ---------------------------------------------------------------------------
describe("list handler", () => {
    it("returns 400 when boss_instance_id is missing", async () => {
        const res = await listHandler(makeListEvent(null));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("boss_instance_id");
        expect(mockListParticipants).not.toHaveBeenCalled();
    });

    it("returns 200 with participants array and count", async () => {
        mockListParticipants.mockResolvedValue([makeParticipant(), makeParticipant({ student_id: "s2" })]);

        const res = await listHandler(makeListEvent("inst-1"));

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(2);
        expect(body.count).toBe(2);
    });

    it("returns 200 with empty array when no participants", async () => {
        mockListParticipants.mockResolvedValue([]);

        const res = await listHandler(makeListEvent("inst-1"));

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toEqual([]);
        expect(body.count).toBe(0);
    });

    it("passes state filter to listParticipants when provided", async () => {
        mockListParticipants.mockResolvedValue([]);

        await listHandler(makeListEvent("inst-1", "JOINED"));

        expect(mockListParticipants).toHaveBeenCalledWith("inst-1", { state: "JOINED" });
    });

    it("calls listParticipants with no state filter when query param absent", async () => {
        mockListParticipants.mockResolvedValue([]);

        await listHandler(makeListEvent("inst-1"));

        expect(mockListParticipants).toHaveBeenCalledWith("inst-1", { state: undefined });
    });

    it("returns 500 when listParticipants throws", async () => {
        mockListParticipants.mockRejectedValue(new Error("Query failed"));

        const res = await listHandler(makeListEvent("inst-1"));

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("Query failed");
    });
});

// ---------------------------------------------------------------------------
// spectate handler
// ---------------------------------------------------------------------------
describe("spectate handler", () => {
    it("returns 400 when boss_instance_id is missing", async () => {
        const res = await spectateHandler(makeSimpleEvent(null));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("boss_instance_id");
    });

    it("returns 401 when JWT sub is missing", async () => {
        const res = await spectateHandler(makeSimpleEvent("inst-1", null));

        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body).error).toContain("Unauthorized");
    });

    it("returns 200 and calls setParticipantSpectate on success", async () => {
        const res = await spectateHandler(makeSimpleEvent("inst-1"));

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).message).toContain("spectate");
        expect(mockSetParticipantSpectate).toHaveBeenCalledWith("inst-1", "student-sub-1");
    });

    it("returns 500 when setParticipantSpectate throws", async () => {
        mockSetParticipantSpectate.mockRejectedValue(new Error("Network error"));

        const res = await spectateHandler(makeSimpleEvent("inst-1"));

        expect(res.statusCode).toBe(500);
    });
});

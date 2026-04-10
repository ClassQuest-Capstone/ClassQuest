/**
 * Unit tests for mutation-resolver.ts — AppSync adapter Lambda for Boss Battle mutations.
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock all downstream handler modules (avoids importing DynamoDB etc.)
// ---------------------------------------------------------------------------
const mockStartBattle    = vi.fn();
const mockStartCountdown = vi.fn();
const mockStartQuestion  = vi.fn();
const mockSubmitAnswer   = vi.fn();
const mockResolveQ       = vi.fn();
const mockAdvanceQ       = vi.fn();
const mockFinishBattle   = vi.fn();

vi.mock("../../bossBattleInstances/start-battle.ts",    () => ({ handler: (...a: any[]) => mockStartBattle(...a) }));
vi.mock("../../bossBattleInstances/start-countdown.ts", () => ({ handler: (...a: any[]) => mockStartCountdown(...a) }));
vi.mock("../../bossBattleInstances/start-question.ts",  () => ({ handler: (...a: any[]) => mockStartQuestion(...a) }));
vi.mock("../../bossBattleInstances/submit-answer.ts",   () => ({ handler: (...a: any[]) => mockSubmitAnswer(...a) }));
vi.mock("../../bossBattleInstances/resolve-question.ts",() => ({ handler: (...a: any[]) => mockResolveQ(...a) }));
vi.mock("../../bossBattleInstances/advance-question.ts",() => ({ handler: (...a: any[]) => mockAdvanceQ(...a) }));
vi.mock("../../bossBattleInstances/finish-battle.ts",   () => ({ handler: (...a: any[]) => mockFinishBattle(...a) }));

const mockJoin     = vi.fn();
const mockSpectate = vi.fn();
const mockLeave    = vi.fn();
const mockKick     = vi.fn();

vi.mock("../../bossBattleParticipants/join.ts",     () => ({ handler: (...a: any[]) => mockJoin(...a) }));
vi.mock("../../bossBattleParticipants/spectate.ts", () => ({ handler: (...a: any[]) => mockSpectate(...a) }));
vi.mock("../../bossBattleParticipants/leave.ts",    () => ({ handler: (...a: any[]) => mockLeave(...a) }));
vi.mock("../../bossBattleParticipants/kick.ts",     () => ({ handler: (...a: any[]) => mockKick(...a) }));

// ---------------------------------------------------------------------------
// Mock repo functions used by the internal publishState / publishRoster helpers
// ---------------------------------------------------------------------------
const mockGetBossBattleInstance = vi.fn();
vi.mock("../../bossBattleInstances/repo.ts", () => ({
    getBossBattleInstance: (...a: any[]) => mockGetBossBattleInstance(...a),
}));

const mockListParticipants = vi.fn();
vi.mock("../../bossBattleParticipants/repo.ts", () => ({
    listParticipants: (...a: any[]) => mockListParticipants(...a),
}));

// ---------------------------------------------------------------------------
// Mock publish-event functions — we verify they are called, not what they send
// ---------------------------------------------------------------------------
const mockPublishBattleStateChanged = vi.fn();
const mockPublishRosterChanged      = vi.fn();
const mockPublishAnswerSubmitted    = vi.fn();

vi.mock("../publish-event.ts", () => ({
    publishBattleStateChanged: (...a: any[]) => mockPublishBattleStateChanged(...a),
    publishRosterChanged:      (...a: any[]) => mockPublishRosterChanged(...a),
    publishAnswerSubmitted:    (...a: any[]) => mockPublishAnswerSubmitted(...a),
}));

// ---------------------------------------------------------------------------
// Module reference
// ---------------------------------------------------------------------------
let mutationHandler: (typeof import("../mutation-resolver.ts"))["handler"];

beforeAll(async () => {
    mutationHandler = (await import("../mutation-resolver.ts")).handler;
});

beforeEach(() => {
    // Reset all handler mocks
    mockStartBattle.mockReset();
    mockStartCountdown.mockReset();
    mockStartQuestion.mockReset();
    mockSubmitAnswer.mockReset();
    mockResolveQ.mockReset();
    mockAdvanceQ.mockReset();
    mockFinishBattle.mockReset();
    mockJoin.mockReset();
    mockSpectate.mockReset();
    mockLeave.mockReset();
    mockKick.mockReset();

    // Reset repo and publish mocks
    mockGetBossBattleInstance.mockReset();
    mockListParticipants.mockReset();
    mockPublishBattleStateChanged.mockReset();
    mockPublishRosterChanged.mockReset();
    mockPublishAnswerSubmitted.mockReset();

    // Default: publish helpers return void
    mockPublishBattleStateChanged.mockResolvedValue(undefined);
    mockPublishRosterChanged.mockResolvedValue(undefined);
    mockPublishAnswerSubmitted.mockResolvedValue(undefined);

    // Default: repo stubs return a minimal instance / empty list
    mockGetBossBattleInstance.mockResolvedValue(makeInstance());
    mockListParticipants.mockResolvedValue([makeParticipant()]);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTeacherEvent(fieldName: string, args: Record<string, any> = {}) {
    return {
        info:      { fieldName },
        arguments: { bossInstanceId: "inst-1", ...args },
        identity:  {
            sub:    "teacher-sub-1",
            groups: ["Teachers"],
        },
    };
}

function makeStudentEvent(fieldName: string, args: Record<string, any> = {}) {
    return {
        info:      { fieldName },
        arguments: { bossInstanceId: "inst-1", ...args },
        identity:  {
            sub:    "student-sub-42",
            groups: ["Students"],
        },
    };
}

function ok200(body: Record<string, any> = {}) {
    return { statusCode: 200, body: JSON.stringify(body) };
}

function err(statusCode: number, error: string) {
    return { statusCode, body: JSON.stringify({ error }) };
}

function makeInstance(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id: "inst-1",
        status:           "LOBBY",
        current_boss_hp:  1000,
        initial_boss_hp:  1000,
        updated_at:       "2026-04-09T10:00:00.000Z",
        ...overrides,
    };
}

function makeParticipant(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id: "inst-1",
        student_id:       "student-sub-42",
        class_id:         "class-1",
        guild_id:         "guild-1",
        state:            "ACTIVE",
        joined_at:        "2026-04-09T10:00:00.000Z",
        updated_at:       "2026-04-09T10:00:00.000Z",
        is_downed:        false,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Lifecycle mutations (teacher) — startBattle as the representative case
// ---------------------------------------------------------------------------
describe("lifecycle mutations — startBattle", () => {
    it("returns success result and calls publishState on 200", async () => {
        mockStartBattle.mockResolvedValue(ok200({ status: "LOBBY" }));

        const result = await mutationHandler(makeTeacherEvent("startBattle"));

        expect(result.success).toBe(true);
        expect(result.statusCode).toBe(200);
        expect(result.message).toBe("OK");

        // publishState fetches the instance then publishes
        expect(mockGetBossBattleInstance).toHaveBeenCalledWith("inst-1");
        expect(mockPublishBattleStateChanged).toHaveBeenCalledOnce();
    });

    it("does NOT call publishState when handler returns a non-200", async () => {
        mockStartBattle.mockResolvedValue(err(409, "Not in DRAFT status"));

        const result = await mutationHandler(makeTeacherEvent("startBattle"));

        expect(result.success).toBe(false);
        expect(result.error).toBe("Not in DRAFT status");
        expect(mockPublishBattleStateChanged).not.toHaveBeenCalled();
    });

    it("passes the correct bossInstanceId as a path parameter to the handler", async () => {
        mockStartBattle.mockResolvedValue(ok200());
        const event = makeTeacherEvent("startBattle", { bossInstanceId: "inst-XYZ" });
        await mutationHandler(event);

        const [handlerArg] = mockStartBattle.mock.calls[0];
        expect(handlerArg.pathParameters.boss_instance_id).toBe("inst-XYZ");
    });

    it("forwards jwtClaims (sub + groups) to the handler's requestContext", async () => {
        mockStartBattle.mockResolvedValue(ok200());
        await mutationHandler(makeTeacherEvent("startBattle"));

        const [handlerArg] = mockStartBattle.mock.calls[0];
        const claims = handlerArg.requestContext.authorizer.jwt.claims;
        expect(claims.sub).toBe("teacher-sub-1");
        expect(claims["cognito:groups"]).toEqual(["Teachers"]);
    });

    it("returns error result for non-200 with statusCode in payload", async () => {
        mockStartBattle.mockResolvedValue(err(404, "INSTANCE_NOT_FOUND"));

        const result = await mutationHandler(makeTeacherEvent("startBattle"));

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(404);
        expect(result.error).toBe("INSTANCE_NOT_FOUND");
    });
});

// ---------------------------------------------------------------------------
// Other lifecycle mutations — spot-check each one dispatches correctly
// ---------------------------------------------------------------------------
describe("lifecycle mutations — other fields", () => {
    const cases: [string, () => typeof vi.fn] = [
        ["startCountdown",  () => mockStartCountdown],
        ["startQuestion",   () => mockStartQuestion],
        ["resolveQuestion", () => mockResolveQ],
        ["advanceQuestion", () => mockAdvanceQ],
        ["finishBattle",    () => mockFinishBattle],
    ] as any;

    for (const [fieldName, getMock] of cases) {
        it(`${fieldName}: returns success on 200 and calls publishState`, async () => {
            const m = getMock() as ReturnType<typeof vi.fn>;
            m.mockResolvedValue(ok200());

            const result = await mutationHandler(makeTeacherEvent(fieldName));

            expect(result.success).toBe(true);
            expect(mockPublishBattleStateChanged).toHaveBeenCalledOnce();
        });
    }
});

// ---------------------------------------------------------------------------
// submitAnswer (student mutation)
// ---------------------------------------------------------------------------
describe("submitAnswer", () => {
    it("returns success with answer body fields spread into result", async () => {
        mockSubmitAnswer.mockResolvedValue(ok200({
            is_correct:            true,
            received_answer_count: 3,
            required_answer_count: 8,
            ready_to_resolve:      false,
        }));

        const result = await mutationHandler(
            makeStudentEvent("submitAnswer", { answerRaw: "B" })
        );

        expect(result.success).toBe(true);
        expect(result.is_correct).toBe(true);
        expect(result.received_answer_count).toBe(3);
    });

    it("calls both publishAnswer and publishState on 200", async () => {
        mockSubmitAnswer.mockResolvedValue(ok200({ is_correct: true }));

        await mutationHandler(makeStudentEvent("submitAnswer", { answerRaw: "A" }));

        expect(mockPublishAnswerSubmitted).toHaveBeenCalledOnce();
        expect(mockPublishBattleStateChanged).toHaveBeenCalledOnce();
    });

    it("derives student_id from identity.sub, not from arguments", async () => {
        mockSubmitAnswer.mockResolvedValue(ok200({ is_correct: true }));

        await mutationHandler(makeStudentEvent("submitAnswer", { answerRaw: "C" }));

        // publishAnswerSubmitted receives the payload built with sub
        const [payload] = mockPublishAnswerSubmitted.mock.calls[0];
        expect(payload.student_id).toBe("student-sub-42");
    });

    it("sends answer_raw in the handler body", async () => {
        mockSubmitAnswer.mockResolvedValue(ok200());

        await mutationHandler(makeStudentEvent("submitAnswer", { answerRaw: "D" }));

        const [handlerArg] = mockSubmitAnswer.mock.calls[0];
        const body = JSON.parse(handlerArg.body);
        expect(body.answer_raw).toBe("D");
    });

    it("does NOT call publishAnswer or publishState on non-200", async () => {
        mockSubmitAnswer.mockResolvedValue(err(409, "FROZEN"));

        const result = await mutationHandler(makeStudentEvent("submitAnswer", { answerRaw: "X" }));

        expect(result.success).toBe(false);
        expect(mockPublishAnswerSubmitted).not.toHaveBeenCalled();
        expect(mockPublishBattleStateChanged).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Roster mutations
// ---------------------------------------------------------------------------
describe("joinBattle", () => {
    it("returns success and calls publishRoster on 200", async () => {
        mockJoin.mockResolvedValue(ok200({ state: "ACTIVE", message: "Joined" }));

        const result = await mutationHandler(
            makeStudentEvent("joinBattle", { guildId: "guild-1" })
        );

        expect(result.success).toBe(true);
        expect(result.state).toBe("ACTIVE");

        expect(mockListParticipants).toHaveBeenCalledWith("inst-1");
        expect(mockPublishRosterChanged).toHaveBeenCalledOnce();
    });

    it("sends guild_id in the handler body", async () => {
        mockJoin.mockResolvedValue(ok200());

        await mutationHandler(makeStudentEvent("joinBattle", { guildId: "guild-99" }));

        const [handlerArg] = mockJoin.mock.calls[0];
        const body = JSON.parse(handlerArg.body);
        expect(body.guild_id).toBe("guild-99");
    });

    it("does NOT call publishRoster on non-200", async () => {
        mockJoin.mockResolvedValue(err(409, "ALREADY_JOINED"));

        const result = await mutationHandler(makeStudentEvent("joinBattle", { guildId: "g-1" }));

        expect(result.success).toBe(false);
        expect(mockPublishRosterChanged).not.toHaveBeenCalled();
    });
});

describe("spectateBattle", () => {
    it("returns success and calls publishRoster on 200", async () => {
        mockSpectate.mockResolvedValue(ok200({ state: "SPECTATING" }));

        const result = await mutationHandler(makeStudentEvent("spectateBattle"));

        expect(result.success).toBe(true);
        expect(mockPublishRosterChanged).toHaveBeenCalledOnce();
    });
});

describe("leaveBattle", () => {
    it("returns success and calls publishRoster on 200", async () => {
        mockLeave.mockResolvedValue(ok200({ state: "LEFT" }));

        const result = await mutationHandler(makeStudentEvent("leaveBattle"));

        expect(result.success).toBe(true);
        expect(mockPublishRosterChanged).toHaveBeenCalledOnce();
    });
});

describe("kickParticipant", () => {
    it("returns success, sends both IDs as path params, and calls publishRoster", async () => {
        mockKick.mockResolvedValue(ok200({ state: "KICKED" }));

        const result = await mutationHandler(
            makeTeacherEvent("kickParticipant", {
                studentId: "student-bad-actor",
                reason:    "disrupting",
            })
        );

        expect(result.success).toBe(true);

        const [handlerArg] = mockKick.mock.calls[0];
        expect(handlerArg.pathParameters.boss_instance_id).toBe("inst-1");
        expect(handlerArg.pathParameters.student_id).toBe("student-bad-actor");

        const body = JSON.parse(handlerArg.body);
        expect(body.reason).toBe("disrupting");

        expect(mockPublishRosterChanged).toHaveBeenCalledOnce();
    });

    it("uses null reason when reason argument is omitted", async () => {
        mockKick.mockResolvedValue(ok200());

        await mutationHandler(
            makeTeacherEvent("kickParticipant", { studentId: "s-1" })
        );

        const [handlerArg] = mockKick.mock.calls[0];
        const body = JSON.parse(handlerArg.body);
        expect(body.reason).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Unknown field
// ---------------------------------------------------------------------------
describe("unknown fieldName", () => {
    it("returns success=false with statusCode 400 and an error message", async () => {
        const result = await mutationHandler(makeTeacherEvent("deleteEverything"));

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(400);
        expect(result.error).toContain("deleteEverything");
    });

    it("handles missing fieldName gracefully (empty string)", async () => {
        const result = await mutationHandler({ info: {}, arguments: {}, identity: {} });

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// Identity extraction
// ---------------------------------------------------------------------------
describe("identity extraction", () => {
    it("reads sub from identity.claims.sub when identity.sub is absent", async () => {
        mockStartBattle.mockResolvedValue(ok200());

        const event = {
            info:      { fieldName: "startBattle" },
            arguments: { bossInstanceId: "inst-1" },
            identity:  {
                claims: { sub: "teacher-claims-sub", "cognito:groups": ["Teachers"] },
            },
        };
        await mutationHandler(event);

        const [handlerArg] = mockStartBattle.mock.calls[0];
        expect(handlerArg.requestContext.authorizer.jwt.claims.sub).toBe("teacher-claims-sub");
    });

    it("reads groups from identity.claims when identity.groups is absent", async () => {
        mockStartBattle.mockResolvedValue(ok200());

        const event = {
            info:      { fieldName: "startBattle" },
            arguments: { bossInstanceId: "inst-1" },
            identity:  {
                sub:    "teacher-direct-sub",
                claims: { "cognito:groups": ["Teachers"] },
            },
        };
        await mutationHandler(event);

        const [handlerArg] = mockStartBattle.mock.calls[0];
        // groups come from identity.groups (undefined) → falls back to claims
        expect(handlerArg.requestContext.authorizer.jwt.claims["cognito:groups"])
            .toEqual(["Teachers"]);
    });

    it("defaults sub and groups to empty values when identity is empty", async () => {
        // When fieldName is unknown the handler returns early without calling any handler
        const result = await mutationHandler({
            info:      { fieldName: "unknownField" },
            arguments: {},
            identity:  {},
        });

        // Just verify the resolver doesn't throw
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Publish failures are non-fatal
// ---------------------------------------------------------------------------
describe("publish errors are non-fatal", () => {
    it("still returns success when publishState (getBossBattleInstance) throws", async () => {
        mockStartBattle.mockResolvedValue(ok200());
        // Simulate publishState error: repo throws
        mockGetBossBattleInstance.mockRejectedValue(new Error("DynamoDB unavailable"));

        const result = await mutationHandler(makeTeacherEvent("startBattle"));

        // Handler itself succeeded — result must be success
        expect(result.success).toBe(true);
        // publishBattleStateChanged was never reached (getBossBattleInstance threw first)
        expect(mockPublishBattleStateChanged).not.toHaveBeenCalled();
    });

    it("still returns success when publishState (publishBattleStateChanged) rejects", async () => {
        mockStartBattle.mockResolvedValue(ok200());
        mockPublishBattleStateChanged.mockRejectedValue(new Error("AppSync down"));

        const result = await mutationHandler(makeTeacherEvent("startBattle"));

        expect(result.success).toBe(true);
    });

    it("still returns success when publishRoster (listParticipants) throws", async () => {
        mockJoin.mockResolvedValue(ok200({ state: "ACTIVE" }));
        mockListParticipants.mockRejectedValue(new Error("Query timeout"));

        const result = await mutationHandler(makeStudentEvent("joinBattle", { guildId: "g-1" }));

        expect(result.success).toBe(true);
        expect(mockPublishRosterChanged).not.toHaveBeenCalled();
    });
});

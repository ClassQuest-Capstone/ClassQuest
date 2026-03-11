/**
 * Unit tests for the StartBattle lifecycle action.
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DynamoDB so no real AWS calls are made.
// vi.mock() is hoisted before imports, ensuring all module loads see mocks.
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
let startBattleHandler: (typeof import("../start-battle.ts"))["handler"];

beforeAll(async () => {
    process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME  = "test-boss-battle-instances";
    process.env.BOSS_BATTLE_TEMPLATES_TABLE_NAME  = "test-boss-battle-templates";
    repoModule          = await import("../repo.ts");
    startBattleHandler  = (await import("../start-battle.ts")).handler;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeInstance(overrides: Record<string, any> = {}) {
    return {
        boss_instance_id:    "inst-1",
        class_id:            "class-1",
        boss_template_id:    "tpl-1",
        created_by_teacher_id: "teacher-1",
        status:              "DRAFT",
        mode_type:           "SIMULTANEOUS_ALL",
        question_selection_mode: "ORDERED",
        initial_boss_hp:     1000,
        current_boss_hp:     1000,
        speed_bonus_enabled: true,
        speed_bonus_floor_multiplier: 0.2,
        speed_window_seconds: 30,
        anti_spam_min_submit_interval_ms: 1500,
        freeze_on_wrong_seconds: 3,
        late_join_policy:    "DISALLOW_AFTER_COUNTDOWN",
        current_question_index: 0,
        created_at:          "2026-01-01T00:00:00.000Z",
        updated_at:          "2026-01-01T00:00:00.000Z",
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

function makeTeacherEvent(boss_instance_id: string) {
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
// repo: startBossBattleInstance
// ---------------------------------------------------------------------------
describe("repo.startBossBattleInstance", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("sends UpdateCommand with DRAFT condition and LOBBY transition", async () => {
        const updatedItem = makeInstance({ status: "LOBBY", lobby_opened_at: "2026-03-10T12:00:00.000Z" });
        mockSend.mockResolvedValueOnce({ Attributes: updatedItem });

        const result = await repoModule.startBossBattleInstance(
            "inst-1",
            "2026-03-10T12:00:00.000Z",
            "2026-03-10T12:00:00.000Z"
        );

        const [cmd] = mockSend.mock.calls[0];
        const params = cmd.input;

        expect(params.ExpressionAttributeValues[":draft"]).toBe("DRAFT");
        expect(params.ExpressionAttributeValues[":lobby"]).toBe("LOBBY");
        expect(params.ConditionExpression).toContain("#status = :draft");
        expect(params.ConditionExpression).toContain("attribute_exists(boss_instance_id)");
        expect(params.ReturnValues).toBe("ALL_NEW");
        expect(result.status).toBe("LOBBY");
        expect(result.lobby_opened_at).toBe("2026-03-10T12:00:00.000Z");
    });

    it("propagates ConditionalCheckFailedException for non-DRAFT status", async () => {
        const err = new Error("Conditional check failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        await expect(
            repoModule.startBossBattleInstance("inst-1", "2026-03-10T12:00:00.000Z", "2026-03-10T12:00:00.000Z")
        ).rejects.toMatchObject({ name: "ConditionalCheckFailedException" });
    });
});

// ---------------------------------------------------------------------------
// handler: start-battle
// ---------------------------------------------------------------------------
describe("startBattle handler", () => {
    beforeEach(() => { mockSend.mockReset(); });

    it("returns 200 with updated instance on successful DRAFT -> LOBBY transition", async () => {
        const instance = makeInstance({ status: "DRAFT" });
        const updatedInstance = makeInstance({
            status: "LOBBY",
            lobby_opened_at: "2026-03-10T12:00:00.000Z",
            updated_at: "2026-03-10T12:00:00.000Z",
        });
        const template = makeTemplate();

        // GetCommand for instance, GetCommand for template, UpdateCommand for transition
        mockSend
            .mockResolvedValueOnce({ Item: instance })   // getBossBattleInstance
            .mockResolvedValueOnce({ Item: template })   // getBossTemplate
            .mockResolvedValueOnce({ Attributes: updatedInstance }); // startBossBattleInstance

        const response = await startBattleHandler(makeTeacherEvent("inst-1"));

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe("LOBBY");
        expect(body.lobby_opened_at).toBeTruthy();
        expect(body.updated_at).toBeTruthy();
    });

    it("returns 409 when a second call hits the DB condition (concurrent start)", async () => {
        const instance = makeInstance({ status: "DRAFT" });
        const template = makeTemplate();
        const condErr = new Error("Conditional check failed");
        condErr.name = "ConditionalCheckFailedException";

        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: template })
            .mockRejectedValueOnce(condErr);

        const response = await startBattleHandler(makeTeacherEvent("inst-1"));

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("DRAFT");
    });

    it("returns 409 when instance status is already LOBBY (pre-check)", async () => {
        const instance = makeInstance({ status: "LOBBY" });
        mockSend.mockResolvedValueOnce({ Item: instance });

        const response = await startBattleHandler(makeTeacherEvent("inst-1"));

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("DRAFT");
        expect(body.current_status).toBe("LOBBY");
    });

    it("returns 409 when instance status is COMPLETED", async () => {
        const instance = makeInstance({ status: "COMPLETED" });
        mockSend.mockResolvedValueOnce({ Item: instance });

        const response = await startBattleHandler(makeTeacherEvent("inst-1"));

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.body);
        expect(body.current_status).toBe("COMPLETED");
    });

    it("returns 404 when instance does not exist", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });

        const response = await startBattleHandler(makeTeacherEvent("nonexistent"));

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.error).toBe("Boss battle instance not found");
    });

    it("returns 409 when referenced template is soft-deleted", async () => {
        const instance = makeInstance({ status: "DRAFT" });
        // getTemplate returns null for soft-deleted items (filtered by repo)
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: { ...makeTemplate(), is_deleted: true } });

        const response = await startBattleHandler(makeTeacherEvent("inst-1"));

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.body);
        expect(body.error).toBe("Cannot start battle from a deleted template");
    });

    it("returns 409 when referenced template does not exist", async () => {
        const instance = makeInstance({ status: "DRAFT" });
        mockSend
            .mockResolvedValueOnce({ Item: instance })
            .mockResolvedValueOnce({ Item: undefined });

        const response = await startBattleHandler(makeTeacherEvent("inst-1"));

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.body);
        expect(body.error).toBe("Cannot start battle from a deleted template");
    });

    it("returns 403 when caller is a student", async () => {
        const studentEvent = {
            pathParameters: { boss_instance_id: "inst-1" },
            body: null,
            requestContext: {
                authorizer: {
                    jwt: {
                        claims: {
                            sub: "student-1",
                            "cognito:groups": "Students",
                        },
                    },
                },
            },
        };

        const response = await startBattleHandler(studentEvent);

        expect(response.statusCode).toBe(403);
        const body = JSON.parse(response.body);
        expect(body.error).toBe("Only teachers can start boss battles");
    });

    it("returns 401 when no user identity is present", async () => {
        const anonEvent = {
            pathParameters: { boss_instance_id: "inst-1" },
            body: null,
            requestContext: {},
        };

        const response = await startBattleHandler(anonEvent);

        expect(response.statusCode).toBe(401);
    });

    it("returns 400 when boss_instance_id path parameter is missing", async () => {
        const response = await startBattleHandler({
            pathParameters: {},
            body: null,
            requestContext: {
                authorizer: {
                    jwt: { claims: { sub: "t1", "cognito:groups": "Teachers" } },
                },
            },
        });

        expect(response.statusCode).toBe(400);
    });
});

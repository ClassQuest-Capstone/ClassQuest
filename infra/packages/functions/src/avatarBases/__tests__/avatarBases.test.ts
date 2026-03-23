/**
 * Unit tests for the AvatarBases feature.
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DynamoDB — must be hoisted before any module imports
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
    ScanCommand:   vi.fn(function (input: any) { return { input }; }),
}));

// ---------------------------------------------------------------------------
// Module references — populated in beforeAll
// ---------------------------------------------------------------------------
let validationModule: typeof import("../validation.ts");
let repoModule:       typeof import("../repo.ts");
let createHandler:    (typeof import("../create.ts"))["handler"];
let getHandler:       (typeof import("../get.ts"))["handler"];
let updateHandler:    (typeof import("../update.ts"))["handler"];
let listHandler:      (typeof import("../list.ts"))["handler"];

beforeAll(async () => {
    process.env.AVATAR_BASES_TABLE_NAME = "test-avatar-bases";

    validationModule = await import("../validation.ts");
    repoModule       = await import("../repo.ts");
    createHandler    = (await import("../create.ts")).handler;
    getHandler       = (await import("../get.ts")).handler;
    updateHandler    = (await import("../update.ts")).handler;
    listHandler      = (await import("../list.ts")).handler;
});

beforeEach(() => { mockSend.mockReset(); });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeBaseRaw(overrides: Record<string, any> = {}) {
    return {
        avatar_base_id:            "healer_male_01",
        gender:                    "MALE",
        role_type:                 "HEALER",
        is_default:                true,
        default_helmet_item_id:    "helmet_healer_default",
        default_armour_item_id:    "armour_healer_default",
        default_shield_item_id:    "shield_healer_default",
        default_pet_item_id:       "pet_healer_default",
        default_background_item_id: "background_forest",
        created_at:                "2026-01-01T00:00:00.000Z",
        updated_at:                "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeCreateBody(overrides: Record<string, any> = {}) {
    return {
        avatar_base_id:            "healer_male_01",
        gender:                    "MALE",
        role_type:                 "HEALER",
        is_default:                true,
        default_helmet_item_id:    "helmet_healer_default",
        default_armour_item_id:    "armour_healer_default",
        default_shield_item_id:    "shield_healer_default",
        default_pet_item_id:       "pet_healer_default",
        default_background_item_id: "background_forest",
        ...overrides,
    };
}

function makeEvent(overrides: Record<string, any> = {}, body?: Record<string, any>) {
    return {
        pathParameters:        {},
        queryStringParameters: {},
        body: body ? JSON.stringify(body) : undefined,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// 1. validation.ts
// ---------------------------------------------------------------------------
describe("validation — validateAvatarBase", () => {
    it("accepts a fully valid base", () => {
        const result = validationModule.validateAvatarBase({
            avatar_base_id: "healer_male_01",
            gender:         "MALE",
            role_type:      "HEALER",
            is_default:     true,
        });
        expect(result.valid).toBe(true);
    });

    it("rejects invalid avatar_base_id (uppercase)", () => {
        const result = validationModule.validateAvatarBase({ avatar_base_id: "HEALER_01" });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/avatar_base_id/);
    });

    it("rejects invalid gender", () => {
        const result = validationModule.validateAvatarBase({ gender: "OTHER" });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/gender/);
    });

    it("accepts all valid genders", () => {
        for (const gender of validationModule.VALID_GENDERS) {
            const result = validationModule.validateAvatarBase({ gender });
            expect(result.valid).toBe(true);
        }
    });

    it("rejects invalid role_type", () => {
        const result = validationModule.validateAvatarBase({ role_type: "WARRIOR" });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/role_type/);
    });

    it("accepts all valid role types", () => {
        for (const role_type of validationModule.VALID_ROLE_TYPES) {
            const result = validationModule.validateAvatarBase({ role_type });
            expect(result.valid).toBe(true);
        }
    });

    it("accepts NONE as role_type", () => {
        const result = validationModule.validateAvatarBase({ role_type: "NONE" });
        expect(result.valid).toBe(true);
    });

    it("rejects is_default that is not a boolean", () => {
        const result = validationModule.validateAvatarBase({ is_default: "true" as any });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/is_default/);
    });

    it("accepts when all default gear item ids are absent", () => {
        const result = validationModule.validateAvatarBase({
            avatar_base_id: "mage_female_01",
            gender:         "FEMALE",
            role_type:      "MAGE",
            is_default:     false,
        });
        expect(result.valid).toBe(true);
    });

    it("accepts when default gear item ids are provided", () => {
        const result = validationModule.validateAvatarBase({
            default_helmet_item_id:    "helmet_mage_01",
            default_armour_item_id:    "armour_mage_01",
            default_shield_item_id:    "shield_none",
            default_pet_item_id:       "pet_owl",
            default_background_item_id: "bg_library",
        });
        expect(result.valid).toBe(true);
    });

    it("rejects empty default gear item id", () => {
        const result = validationModule.validateAvatarBase({ default_helmet_item_id: "  " });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/default_helmet_item_id/);
    });
});

// ---------------------------------------------------------------------------
// 2. repo — getBase
// ---------------------------------------------------------------------------
describe("repo — getBase", () => {
    it("returns the base when found", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeBaseRaw() });
        const base = await repoModule.getBase("healer_male_01");
        expect(base).not.toBeNull();
        expect(base?.avatar_base_id).toBe("healer_male_01");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Key).toEqual({ avatar_base_id: "healer_male_01" });
    });

    it("returns null when base not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const base = await repoModule.getBase("nonexistent");
        expect(base).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 3. repo — listBases
// ---------------------------------------------------------------------------
describe("repo — listBases", () => {
    it("scans the table", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeBaseRaw()], LastEvaluatedKey: undefined });
        const result = await repoModule.listBases(10);

        expect(result.items).toHaveLength(1);
        expect(result.cursor).toBeUndefined();
    });

    it("returns base64 cursor when LastEvaluatedKey is present", async () => {
        const lastKey = { avatar_base_id: "x" };
        mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: lastKey });
        const result = await repoModule.listBases(10);

        expect(result.cursor).toBeDefined();
        const decoded = JSON.parse(Buffer.from(result.cursor!, "base64").toString());
        expect(decoded).toEqual(lastKey);
    });
});

// ---------------------------------------------------------------------------
// 4. repo — listBasesByGender
// ---------------------------------------------------------------------------
describe("repo — listBasesByGender", () => {
    it("queries GSI1 with gender = MALE", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeBaseRaw()], LastEvaluatedKey: undefined });
        const result = await repoModule.listBasesByGender("MALE");

        expect(result.items).toHaveLength(1);
        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.ExpressionAttributeValues[":gender"]).toBe("MALE");
    });
});

// ---------------------------------------------------------------------------
// 5. create handler
// ---------------------------------------------------------------------------
describe("create handler", () => {
    it("returns 201 on success", async () => {
        mockSend.mockResolvedValueOnce({});

        const res = await createHandler(makeEvent({}, makeCreateBody()) as any);
        expect(res.statusCode).toBe(201);
        expect(JSON.parse(res.body).avatar_base_id).toBe("healer_male_01");
    });

    it("returns 400 when required fields are missing", async () => {
        const res = await createHandler(makeEvent({}, { avatar_base_id: "x" }) as any);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).required).toBeDefined();
    });

    it("returns 400 for invalid gender", async () => {
        const res = await createHandler(makeEvent({}, makeCreateBody({ gender: "OTHER" })) as any);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/gender/);
    });

    it("returns 400 for invalid role_type", async () => {
        const res = await createHandler(makeEvent({}, makeCreateBody({ role_type: "WARRIOR" })) as any);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/role_type/);
    });

    it("returns 201 when all optional gear fields are absent", async () => {
        mockSend.mockResolvedValueOnce({});
        const body = {
            avatar_base_id: "guardian_female_01",
            gender:         "FEMALE",
            role_type:      "GUARDIAN",
            is_default:     false,
        };
        const res = await createHandler(makeEvent({}, body) as any);
        expect(res.statusCode).toBe(201);
    });

    it("returns 409 when base already exists", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const res = await createHandler(makeEvent({}, makeCreateBody()) as any);
        expect(res.statusCode).toBe(409);
    });
});

// ---------------------------------------------------------------------------
// 6. get handler
// ---------------------------------------------------------------------------
describe("get handler", () => {
    it("returns 200 with base on success", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeBaseRaw() });

        const res = await getHandler(
            makeEvent({ pathParameters: { avatar_base_id: "healer_male_01" } }) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).avatar_base_id).toBe("healer_male_01");
    });

    it("returns 200 with gear fields included", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeBaseRaw() });

        const res = await getHandler(
            makeEvent({ pathParameters: { avatar_base_id: "healer_male_01" } }) as any
        );
        const body = JSON.parse(res.body);
        expect(body.default_helmet_item_id).toBe("helmet_healer_default");
        expect(body.default_pet_item_id).toBe("pet_healer_default");
    });

    it("returns 400 when avatar_base_id is missing from path", async () => {
        const res = await getHandler(makeEvent({ pathParameters: {} }) as any);
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 when base does not exist", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });

        const res = await getHandler(
            makeEvent({ pathParameters: { avatar_base_id: "nonexistent" } }) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 7. update handler
// ---------------------------------------------------------------------------
describe("update handler", () => {
    it("returns 200 when updating default gear ids", async () => {
        const updated = makeBaseRaw({ default_helmet_item_id: "helmet_healer_v2" });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        const res = await updateHandler(
            makeEvent(
                { pathParameters: { avatar_base_id: "healer_male_01" } },
                { default_helmet_item_id: "helmet_healer_v2" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).default_helmet_item_id).toBe("helmet_healer_v2");
    });

    it("returns 200 when updating is_default", async () => {
        const updated = makeBaseRaw({ is_default: false });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        const res = await updateHandler(
            makeEvent(
                { pathParameters: { avatar_base_id: "healer_male_01" } },
                { is_default: false }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).is_default).toBe(false);
    });

    it("returns 400 when no fields provided", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { avatar_base_id: "healer_male_01" } }, {}) as any
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when avatar_base_id is missing from path", async () => {
        const res = await updateHandler(makeEvent({ pathParameters: {} }, { is_default: true }) as any);
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid role_type on update", async () => {
        const res = await updateHandler(
            makeEvent(
                { pathParameters: { avatar_base_id: "healer_male_01" } },
                { role_type: "WARRIOR" }
            ) as any
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/role_type/);
    });

    it("returns 404 when base does not exist", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const res = await updateHandler(
            makeEvent({ pathParameters: { avatar_base_id: "ghost" } }, { is_default: true }) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 8. list handler
// ---------------------------------------------------------------------------
describe("list handler", () => {
    it("returns 200 with items and count (scan all)", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeBaseRaw()], LastEvaluatedKey: undefined });

        const res = await listHandler(makeEvent() as any);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.count).toBe(1);
        expect(body.cursor).toBeNull();
    });

    it("returns 200 filtering by gender=MALE via GSI1", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeBaseRaw()], LastEvaluatedKey: undefined });

        const res = await listHandler(
            makeEvent({ queryStringParameters: { gender: "MALE" } }) as any
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.gender).toBe("MALE");
        expect(body.items).toHaveLength(1);
    });

    it("returns 400 for invalid gender filter", async () => {
        const res = await listHandler(
            makeEvent({ queryStringParameters: { gender: "OTHER" } }) as any
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/gender/);
    });

    it("returns 400 for invalid limit", async () => {
        const res = await listHandler(
            makeEvent({ queryStringParameters: { limit: "0" } }) as any
        );
        expect(res.statusCode).toBe(400);
    });

    it("clamps limit to 500", async () => {
        mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });

        await listHandler(makeEvent({ queryStringParameters: { limit: "9999" } }) as any);
        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Limit).toBe(500);
    });
});

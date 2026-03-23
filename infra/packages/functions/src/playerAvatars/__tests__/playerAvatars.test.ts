/**
 * Unit tests for the PlayerAvatars feature.
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
    PutCommand:    vi.fn(function (input: any) { return { input }; }),
    GetCommand:    vi.fn(function (input: any) { return { input }; }),
    QueryCommand:  vi.fn(function (input: any) { return { input }; }),
    UpdateCommand: vi.fn(function (input: any) { return { input }; }),
}));

// Mock cross-domain repo functions used by equip/unequip handlers
const mockGetInventoryItem = vi.fn();
const mockGetShopItem      = vi.fn();
const mockGetAvatarBase    = vi.fn();

vi.mock("../../inventoryItems/repo.ts", () => ({
    getInventoryItem: (...args: any[]) => mockGetInventoryItem(...args),
}));

vi.mock("../../shopItems/repo.ts", () => ({
    getItem: (...args: any[]) => mockGetShopItem(...args),
}));

vi.mock("../../avatarBases/repo.ts", () => ({
    getBase: (...args: any[]) => mockGetAvatarBase(...args),
}));

// ---------------------------------------------------------------------------
// Module references
// ---------------------------------------------------------------------------
let validationModule:          typeof import("../validation.ts");
let repoModule:                typeof import("../repo.ts");
let createHandler:             (typeof import("../create.ts"))["handler"];
let getHandler:                (typeof import("../get.ts"))["handler"];
let getByClassStudentHandler:  (typeof import("../get-by-class-student.ts"))["handler"];
let updateHandler:             (typeof import("../update.ts"))["handler"];
let listByClassHandler:        (typeof import("../list-by-class.ts"))["handler"];
let equipHandler:              (typeof import("../equip.ts"))["handler"];
let unequipHandler:            (typeof import("../unequip.ts"))["handler"];

beforeAll(async () => {
    process.env.PLAYER_AVATARS_TABLE_NAME  = "test-player-avatars";
    process.env.INVENTORY_ITEMS_TABLE_NAME = "test-inventory-items";
    process.env.SHOP_ITEMS_TABLE_NAME      = "test-shop-items";
    process.env.AVATAR_BASES_TABLE_NAME    = "test-avatar-bases";

    validationModule         = await import("../validation.ts");
    repoModule               = await import("../repo.ts");
    createHandler            = (await import("../create.ts")).handler;
    getHandler               = (await import("../get.ts")).handler;
    getByClassStudentHandler = (await import("../get-by-class-student.ts")).handler;
    updateHandler            = (await import("../update.ts")).handler;
    listByClassHandler       = (await import("../list-by-class.ts")).handler;
    equipHandler             = (await import("../equip.ts")).handler;
    unequipHandler           = (await import("../unequip.ts")).handler;
});

beforeEach(() => {
    mockSend.mockReset();
    mockGetInventoryItem.mockReset();
    mockGetShopItem.mockReset();
    mockGetAvatarBase.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAvatarRaw(overrides: Record<string, any> = {}) {
    return {
        player_avatar_id:           "avatar-uuid-001",
        class_id:                   "class-001",
        student_id:                 "student-001",
        avatar_base_id:             "healer_male_01",
        gender:                     "MALE",
        equipped_helmet_item_id:    "helmet_iron_01",
        equipped_armour_item_id:    "armour_basic_01",
        gsi1pk:                     "CLASS#class-001",
        gsi1sk:                     "STUDENT#student-001",
        updated_at:                 "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeCreateBody(overrides: Record<string, any> = {}) {
    return {
        class_id:      "class-001",
        student_id:    "student-001",
        avatar_base_id: "healer_male_01",
        gender:        "MALE",
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
describe("validation — validatePlayerAvatar", () => {
    it("accepts a fully valid input", () => {
        const result = validationModule.validatePlayerAvatar({
            class_id:       "class-001",
            student_id:     "student-001",
            avatar_base_id: "healer_male_01",
            gender:         "MALE",
        });
        expect(result.valid).toBe(true);
    });

    it("rejects invalid gender", () => {
        const result = validationModule.validatePlayerAvatar({ gender: "OTHER" });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/gender/);
    });

    it("accepts all valid genders", () => {
        for (const gender of validationModule.VALID_AVATAR_GENDERS) {
            expect(validationModule.validatePlayerAvatar({ gender }).valid).toBe(true);
        }
    });

    it("rejects empty class_id", () => {
        const result = validationModule.validatePlayerAvatar({ class_id: "  " });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/class_id/);
    });

    it("accepts optional equipped slots absent", () => {
        const result = validationModule.validatePlayerAvatar({
            class_id:       "class-001",
            student_id:     "student-001",
            avatar_base_id: "healer_male_01",
            gender:         "FEMALE",
        });
        expect(result.valid).toBe(true);
    });

    it("accepts optional equipped slots when provided", () => {
        const result = validationModule.validatePlayerAvatar({
            equipped_helmet_item_id:    "helmet_iron_01",
            equipped_armour_item_id:    "armour_basic_01",
            equipped_background_item_id: "bg_forest_01",
        });
        expect(result.valid).toBe(true);
    });

    it("rejects empty equipped slot value", () => {
        const result = validationModule.validatePlayerAvatar({ equipped_pet_item_id: "  " });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/equipped_pet_item_id/);
    });
});

// ---------------------------------------------------------------------------
// 2. repo — key builders
// ---------------------------------------------------------------------------
describe("repo — key builders", () => {
    it("makeGsi1Pk builds CLASS# prefix", () => {
        expect(repoModule.makeGsi1Pk("class-001")).toBe("CLASS#class-001");
    });

    it("makeGsi1Sk builds STUDENT# prefix", () => {
        expect(repoModule.makeGsi1Sk("student-001")).toBe("STUDENT#student-001");
    });
});

// ---------------------------------------------------------------------------
// 3. repo — getAvatar
// ---------------------------------------------------------------------------
describe("repo — getAvatar", () => {
    it("returns avatar when found", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeAvatarRaw() });
        const avatar = await repoModule.getAvatar("avatar-uuid-001");
        expect(avatar?.player_avatar_id).toBe("avatar-uuid-001");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Key).toEqual({ player_avatar_id: "avatar-uuid-001" });
    });

    it("returns null when not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        expect(await repoModule.getAvatar("ghost")).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 4. repo — getAvatarByClassAndStudent
// ---------------------------------------------------------------------------
describe("repo — getAvatarByClassAndStudent", () => {
    it("queries GSI1 with CLASS# and STUDENT# prefixes", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeAvatarRaw()] });
        const avatar = await repoModule.getAvatarByClassAndStudent("class-001", "student-001");

        expect(avatar?.student_id).toBe("student-001");
        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.ExpressionAttributeValues[":pk"]).toBe("CLASS#class-001");
        expect(cmd.input.ExpressionAttributeValues[":sk"]).toBe("STUDENT#student-001");
    });

    it("returns null when no match found", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        expect(await repoModule.getAvatarByClassAndStudent("c", "s")).toBeNull();
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
        expect(JSON.parse(res.body).student_id).toBe("student-001");
    });

    it("returns 400 when required fields are missing", async () => {
        const res = await createHandler(makeEvent({}, { class_id: "c" }) as any);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).required).toBeDefined();
    });

    it("returns 400 for invalid gender", async () => {
        const res = await createHandler(makeEvent({}, makeCreateBody({ gender: "OTHER" })) as any);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/gender/);
    });

    it("returns 201 when equipped slots are absent", async () => {
        mockSend.mockResolvedValueOnce({});
        const res = await createHandler(makeEvent({}, makeCreateBody()) as any);
        expect(res.statusCode).toBe(201);
    });

    it("returns 201 when equipped slots are provided", async () => {
        mockSend.mockResolvedValueOnce({});
        const res = await createHandler(makeEvent({}, makeCreateBody({
            equipped_helmet_item_id: "helmet_iron_01",
        })) as any);
        expect(res.statusCode).toBe(201);
    });

    it("updated_at is set on create", async () => {
        let capturedItem: any;
        mockSend.mockImplementationOnce((cmd: any) => {
            capturedItem = cmd.input.Item;
            return Promise.resolve({});
        });
        await createHandler(makeEvent({}, makeCreateBody()) as any);
        expect(capturedItem.updated_at).toBeDefined();
        expect(typeof capturedItem.updated_at).toBe("string");
    });
});

// ---------------------------------------------------------------------------
// 6. get handler
// ---------------------------------------------------------------------------
describe("get handler", () => {
    it("returns 200 with avatar", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeAvatarRaw() });
        const res = await getHandler(
            makeEvent({ pathParameters: { player_avatar_id: "avatar-uuid-001" } }) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).player_avatar_id).toBe("avatar-uuid-001");
    });

    it("returns 400 when path param is missing", async () => {
        const res = await getHandler(makeEvent({ pathParameters: {} }) as any);
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 when not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const res = await getHandler(
            makeEvent({ pathParameters: { player_avatar_id: "ghost" } }) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 7. get-by-class-student handler
// ---------------------------------------------------------------------------
describe("get-by-class-student handler", () => {
    it("returns 200 for existing record", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeAvatarRaw()] });
        const res = await getByClassStudentHandler(
            makeEvent({ pathParameters: { class_id: "class-001", student_id: "student-001" } }) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).class_id).toBe("class-001");
    });

    it("returns 400 when class_id missing", async () => {
        const res = await getByClassStudentHandler(
            makeEvent({ pathParameters: { student_id: "s" } }) as any
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 when not found", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        const res = await getByClassStudentHandler(
            makeEvent({ pathParameters: { class_id: "c", student_id: "s" } }) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 8. update handler
// ---------------------------------------------------------------------------
describe("update handler", () => {
    it("returns 200 when updating avatar_base_id", async () => {
        const updated = makeAvatarRaw({ avatar_base_id: "mage_male_01" });
        mockSend.mockResolvedValueOnce({ Attributes: updated });
        const res = await updateHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "avatar-uuid-001" } },
                { avatar_base_id: "mage_male_01" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).avatar_base_id).toBe("mage_male_01");
    });

    it("returns 200 when updating equipped slots", async () => {
        const updated = makeAvatarRaw({ equipped_pet_item_id: "pet_owl_01" });
        mockSend.mockResolvedValueOnce({ Attributes: updated });
        const res = await updateHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "avatar-uuid-001" } },
                { equipped_pet_item_id: "pet_owl_01" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).equipped_pet_item_id).toBe("pet_owl_01");
    });

    it("returns 400 when no fields provided", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { player_avatar_id: "avatar-uuid-001" } }, {}) as any
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 when not found", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);
        const res = await updateHandler(
            makeEvent({ pathParameters: { player_avatar_id: "ghost" } }, { gender: "FEMALE" }) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 9. list-by-class handler
// ---------------------------------------------------------------------------
describe("list-by-class handler", () => {
    it("returns 200 with items and count", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeAvatarRaw()], LastEvaluatedKey: undefined });
        const res = await listByClassHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }) as any
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.class_id).toBe("class-001");
    });

    it("returns 400 when class_id missing", async () => {
        const res = await listByClassHandler(makeEvent({ pathParameters: {} }) as any);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// 10. equip handler
// ---------------------------------------------------------------------------
describe("equip handler", () => {
    const avatarRecord = makeAvatarRaw({ gender: "MALE" });

    it("equips a valid owned MALE-compatible item", async () => {
        // getAvatar → mockSend
        mockSend.mockResolvedValueOnce({ Item: avatarRecord });
        // getInventoryItem → mockGetInventoryItem
        mockGetInventoryItem.mockResolvedValueOnce({ student_id: "student-001", item_id: "helmet_iron_01" });
        // getShopItem → mockGetShopItem
        mockGetShopItem.mockResolvedValueOnce({ category: "HELMET", gender: "MALE" });
        // updateAvatar → mockSend
        mockSend.mockResolvedValueOnce({ Attributes: makeAvatarRaw({ equipped_helmet_item_id: "helmet_iron_01" }) });

        const res = await equipHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "avatar-uuid-001" } },
                { slot: "helmet", item_id: "helmet_iron_01" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).equipped_helmet_item_id).toBe("helmet_iron_01");
    });

    it("equips a UNISEX item regardless of avatar gender", async () => {
        mockSend.mockResolvedValueOnce({ Item: avatarRecord });
        mockGetInventoryItem.mockResolvedValueOnce({ student_id: "student-001", item_id: "pet_generic_01" });
        mockGetShopItem.mockResolvedValueOnce({ category: "PET", gender: "UNISEX" });
        mockSend.mockResolvedValueOnce({ Attributes: makeAvatarRaw({ equipped_pet_item_id: "pet_generic_01" }) });

        const res = await equipHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "avatar-uuid-001" } },
                { slot: "pet", item_id: "pet_generic_01" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
    });

    it("returns 400 for invalid slot", async () => {
        const res = await equipHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "avatar-uuid-001" } },
                { slot: "wings", item_id: "some_item" }
            ) as any
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/slot/);
    });

    it("returns 403 when student does not own the item", async () => {
        mockSend.mockResolvedValueOnce({ Item: avatarRecord });
        mockGetInventoryItem.mockResolvedValueOnce(null); // not owned

        const res = await equipHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "avatar-uuid-001" } },
                { slot: "helmet", item_id: "helmet_unowned" }
            ) as any
        );
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body).error).toMatch(/does not own/);
    });

    it("returns 400 when item category does not match slot", async () => {
        mockSend.mockResolvedValueOnce({ Item: avatarRecord });
        mockGetInventoryItem.mockResolvedValueOnce({ student_id: "student-001" });
        mockGetShopItem.mockResolvedValueOnce({ category: "PET", gender: "UNISEX" }); // wrong category for helmet slot

        const res = await equipHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "avatar-uuid-001" } },
                { slot: "helmet", item_id: "pet_owl" }
            ) as any
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/category/);
    });

    it("returns 400 when item gender is incompatible", async () => {
        mockSend.mockResolvedValueOnce({ Item: avatarRecord }); // avatar gender MALE
        mockGetInventoryItem.mockResolvedValueOnce({ student_id: "student-001" });
        mockGetShopItem.mockResolvedValueOnce({ category: "HELMET", gender: "FEMALE" }); // FEMALE item

        const res = await equipHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "avatar-uuid-001" } },
                { slot: "helmet", item_id: "helmet_female_only" }
            ) as any
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/gender/);
    });

    it("returns 404 when player avatar not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const res = await equipHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "ghost" } },
                { slot: "helmet", item_id: "helmet_iron_01" }
            ) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 11. unequip handler
// ---------------------------------------------------------------------------
describe("unequip handler", () => {
    it("unequips slot and resets to AvatarBases default", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeAvatarRaw() }); // getAvatar
        mockGetAvatarBase.mockResolvedValueOnce({                  // getAvatarBase
            avatar_base_id:         "healer_male_01",
            default_helmet_item_id: "helmet_healer_default",
        });
        mockSend.mockResolvedValueOnce({                           // updateAvatar
            Attributes: makeAvatarRaw({ equipped_helmet_item_id: "helmet_healer_default" }),
        });

        const res = await unequipHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "avatar-uuid-001" } },
                { slot: "helmet" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.reset_to).toBe("helmet_healer_default");
        expect(body.unequipped_slot).toBe("helmet");
    });

    it("unequips slot with no default (reset_to = null)", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeAvatarRaw() });
        mockGetAvatarBase.mockResolvedValueOnce({
            avatar_base_id: "healer_male_01",
            // no default_shield_item_id
        });
        mockSend.mockResolvedValueOnce({
            Attributes: makeAvatarRaw(),
        });

        const res = await unequipHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "avatar-uuid-001" } },
                { slot: "shield" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).reset_to).toBeNull();
    });

    it("returns 400 for invalid slot", async () => {
        const res = await unequipHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "avatar-uuid-001" } },
                { slot: "wings" }
            ) as any
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 when player avatar not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const res = await unequipHandler(
            makeEvent(
                { pathParameters: { player_avatar_id: "ghost" } },
                { slot: "helmet" }
            ) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

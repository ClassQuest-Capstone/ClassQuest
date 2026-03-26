/**
 * Unit tests for the EquippedItems feature.
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
let repoModule:                typeof import("../repo.ts");
let createHandler:             (typeof import("../create.ts"))["handler"];
let getHandler:                (typeof import("../get.ts"))["handler"];
let getByClassStudentHandler:  (typeof import("../get-by-class-student.ts"))["handler"];
let updateHandler:             (typeof import("../update.ts"))["handler"];
let listByClassHandler:        (typeof import("../list-by-class.ts"))["handler"];
let equipHandler:              (typeof import("../equip.ts"))["handler"];
let unequipHandler:            (typeof import("../unequip.ts"))["handler"];

beforeAll(async () => {
    process.env.EQUIPPED_ITEMS_TABLE_NAME  = "test-equipped-items";
    process.env.INVENTORY_ITEMS_TABLE_NAME = "test-inventory-items";
    process.env.SHOP_ITEMS_TABLE_NAME      = "test-shop-items";
    process.env.AVATAR_BASES_TABLE_NAME    = "test-avatar-bases";

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
function makeRecordRaw(overrides: Record<string, any> = {}) {
    return {
        equipped_id:        "equipped-uuid-001",
        class_id:           "class-001",
        student_id:         "student-001",
        avatar_base_id:     "healer_male_01",
        helmet_item_id:     "helmet_default_01",
        armour_item_id:     "armour_default_01",
        hand_item_id:       "shield_default_01",
        pet_item_id:        undefined,
        background_item_id: undefined,
        gsi1pk:             "CLASS#class-001",
        gsi1sk:             "STUDENT#student-001",
        equipped_at:        "2026-01-01T00:00:00.000Z",
        updated_at:         "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeCreateBody(overrides: Record<string, any> = {}) {
    return {
        class_id:       "class-001",
        student_id:     "student-001",
        avatar_base_id: "healer_male_01",
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
// 1. repo — key builders
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
// 2. create handler
// ---------------------------------------------------------------------------
describe("create handler", () => {
    it("creates with defaults from AvatarBases (201)", async () => {
        // getEquippedItemsByClassAndStudent (GSI query) → no existing
        mockSend.mockResolvedValueOnce({ Items: [] });
        // getAvatarBase
        mockGetAvatarBase.mockResolvedValueOnce({
            avatar_base_id:         "healer_male_01",
            gender:                 "MALE",
            default_helmet_item_id: "helmet_healer_default",
            default_armour_item_id: "armour_healer_default",
            default_shield_item_id: "shield_healer_default",
        });
        // createEquippedItems (put)
        mockSend.mockResolvedValueOnce({});

        const res = await createHandler(makeEvent({}, makeCreateBody()) as any);

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.student_id).toBe("student-001");
        expect(body.class_id).toBe("class-001");
        expect(body.helmet_item_id).toBe("helmet_healer_default");
        expect(body.armour_item_id).toBe("armour_healer_default");
        expect(body.hand_item_id).toBe("shield_healer_default");
    });

    it("returns 400 when class_id is missing", async () => {
        const res = await createHandler(makeEvent({}, { student_id: "s", avatar_base_id: "a" }) as any);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/class_id/);
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await createHandler(makeEvent({}, { class_id: "c", avatar_base_id: "a" }) as any);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/student_id/);
    });

    it("returns 400 when avatar_base_id is missing", async () => {
        const res = await createHandler(makeEvent({}, { class_id: "c", student_id: "s" }) as any);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/avatar_base_id/);
    });

    it("returns 409 when record already exists for this student+class (duplicate)", async () => {
        // getEquippedItemsByClassAndStudent returns existing record
        mockSend.mockResolvedValueOnce({ Items: [makeRecordRaw()] });

        const res = await createHandler(makeEvent({}, makeCreateBody()) as any);
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).equipped_id).toBe("equipped-uuid-001");
    });

    it("initializes slots to undefined when AvatarBases has no defaults", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        mockGetAvatarBase.mockResolvedValueOnce({ avatar_base_id: "base_no_defaults" });
        let capturedItem: any;
        mockSend.mockImplementationOnce((cmd: any) => {
            capturedItem = cmd.input.Item;
            return Promise.resolve({});
        });

        await createHandler(makeEvent({}, makeCreateBody()) as any);
        expect(capturedItem.helmet_item_id).toBeUndefined();
        expect(capturedItem.hand_item_id).toBeUndefined();
    });

    it("equipped_at and updated_at are set on create", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        mockGetAvatarBase.mockResolvedValueOnce(null);
        let capturedItem: any;
        mockSend.mockImplementationOnce((cmd: any) => {
            capturedItem = cmd.input.Item;
            return Promise.resolve({});
        });

        await createHandler(makeEvent({}, makeCreateBody()) as any);
        expect(capturedItem.equipped_at).toBeDefined();
        expect(capturedItem.updated_at).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// 3. get handler
// ---------------------------------------------------------------------------
describe("get handler", () => {
    it("returns 200 with record", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeRecordRaw() });
        const res = await getHandler(
            makeEvent({ pathParameters: { equipped_id: "equipped-uuid-001" } }) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).equipped_id).toBe("equipped-uuid-001");
    });

    it("returns 400 when path param is missing", async () => {
        const res = await getHandler(makeEvent({ pathParameters: {} }) as any);
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 when not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const res = await getHandler(
            makeEvent({ pathParameters: { equipped_id: "ghost" } }) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 4. get-by-class-student handler
// ---------------------------------------------------------------------------
describe("get-by-class-student handler", () => {
    it("returns 200 for existing record", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeRecordRaw()] });
        const res = await getByClassStudentHandler(
            makeEvent({ pathParameters: { class_id: "class-001", student_id: "student-001" } }) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).class_id).toBe("class-001");
        expect(JSON.parse(res.body).student_id).toBe("student-001");
    });

    it("returns 400 when class_id missing", async () => {
        const res = await getByClassStudentHandler(
            makeEvent({ pathParameters: { student_id: "s" } }) as any
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when student_id missing", async () => {
        const res = await getByClassStudentHandler(
            makeEvent({ pathParameters: { class_id: "c" } }) as any
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
// 5. update handler
// ---------------------------------------------------------------------------
describe("update handler", () => {
    it("returns 200 when updating avatar_base_id", async () => {
        const updated = makeRecordRaw({ avatar_base_id: "mage_female_01" });
        mockSend.mockResolvedValueOnce({ Attributes: updated });
        const res = await updateHandler(
            makeEvent(
                { pathParameters: { equipped_id: "equipped-uuid-001" } },
                { avatar_base_id: "mage_female_01" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).avatar_base_id).toBe("mage_female_01");
    });

    it("returns 200 when updating a slot field", async () => {
        const updated = makeRecordRaw({ pet_item_id: "pet_owl_01" });
        mockSend.mockResolvedValueOnce({ Attributes: updated });
        const res = await updateHandler(
            makeEvent(
                { pathParameters: { equipped_id: "equipped-uuid-001" } },
                { pet_item_id: "pet_owl_01" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).pet_item_id).toBe("pet_owl_01");
    });

    it("returns 400 when no fields provided", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { equipped_id: "equipped-uuid-001" } }, {}) as any
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/No updatable fields/);
    });

    it("returns 400 when a slot field is an empty string", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { equipped_id: "equipped-uuid-001" } }, { helmet_item_id: "  " }) as any
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/helmet_item_id/);
    });

    it("returns 404 (via ConditionalCheckFailedException) when record not found", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);
        const res = await updateHandler(
            makeEvent({ pathParameters: { equipped_id: "ghost" } }, { avatar_base_id: "base_x" }) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 6. list-by-class handler
// ---------------------------------------------------------------------------
describe("list-by-class handler", () => {
    it("returns 200 with items and count", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeRecordRaw()], LastEvaluatedKey: undefined });
        const res = await listByClassHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }) as any
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.class_id).toBe("class-001");
        expect(body.count).toBe(1);
    });

    it("returns 400 when class_id missing", async () => {
        const res = await listByClassHandler(makeEvent({ pathParameters: {} }) as any);
        expect(res.statusCode).toBe(400);
    });

    it("includes cursor when LastEvaluatedKey is present", async () => {
        mockSend.mockResolvedValueOnce({
            Items: [makeRecordRaw()],
            LastEvaluatedKey: { equipped_id: "equipped-uuid-001" },
        });
        const res = await listByClassHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }) as any
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.cursor).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------
// 7. equip handler
// ---------------------------------------------------------------------------
describe("equip handler", () => {
    const equippedRecord = makeRecordRaw({ avatar_base_id: "healer_male_01" });

    it("equips a valid owned UNISEX item", async () => {
        mockSend.mockResolvedValueOnce({ Item: equippedRecord });
        mockGetInventoryItem.mockResolvedValueOnce({ student_id: "student-001", item_id: "pet_owl_01" });
        mockGetShopItem.mockResolvedValueOnce({ category: "PET", gender: "UNISEX" });
        mockGetAvatarBase.mockResolvedValueOnce({ avatar_base_id: "healer_male_01", gender: "MALE" });
        mockSend.mockResolvedValueOnce({ Attributes: makeRecordRaw({ pet_item_id: "pet_owl_01" }) });

        const res = await equipHandler(
            makeEvent(
                { pathParameters: { equipped_id: "equipped-uuid-001" } },
                { slot: "pet", item_id: "pet_owl_01" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).pet_item_id).toBe("pet_owl_01");
    });

    it("equips a gender-matching item (MALE item on MALE avatar)", async () => {
        mockSend.mockResolvedValueOnce({ Item: equippedRecord });
        mockGetInventoryItem.mockResolvedValueOnce({ student_id: "student-001", item_id: "helmet_iron_01" });
        mockGetShopItem.mockResolvedValueOnce({ category: "HELMET", gender: "MALE" });
        mockGetAvatarBase.mockResolvedValueOnce({ avatar_base_id: "healer_male_01", gender: "MALE" });
        mockSend.mockResolvedValueOnce({ Attributes: makeRecordRaw({ helmet_item_id: "helmet_iron_01" }) });

        const res = await equipHandler(
            makeEvent(
                { pathParameters: { equipped_id: "equipped-uuid-001" } },
                { slot: "helmet", item_id: "helmet_iron_01" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).helmet_item_id).toBe("helmet_iron_01");
    });

    it("returns 400 for invalid slot", async () => {
        const res = await equipHandler(
            makeEvent(
                { pathParameters: { equipped_id: "equipped-uuid-001" } },
                { slot: "wings", item_id: "some_item" }
            ) as any
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/slot/);
    });

    it("returns 403 when student does not own the item", async () => {
        mockSend.mockResolvedValueOnce({ Item: equippedRecord });
        mockGetInventoryItem.mockResolvedValueOnce(null); // not owned

        const res = await equipHandler(
            makeEvent(
                { pathParameters: { equipped_id: "equipped-uuid-001" } },
                { slot: "helmet", item_id: "helmet_unowned" }
            ) as any
        );
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body).error).toMatch(/does not own/);
    });

    it("returns 400 when item category does not match slot", async () => {
        mockSend.mockResolvedValueOnce({ Item: equippedRecord });
        mockGetInventoryItem.mockResolvedValueOnce({ student_id: "student-001" });
        mockGetShopItem.mockResolvedValueOnce({ category: "PET", gender: "UNISEX" }); // wrong for helmet slot

        const res = await equipHandler(
            makeEvent(
                { pathParameters: { equipped_id: "equipped-uuid-001" } },
                { slot: "helmet", item_id: "pet_owl" }
            ) as any
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/category/);
    });

    it("returns 400 when item gender is incompatible with avatar gender", async () => {
        mockSend.mockResolvedValueOnce({ Item: equippedRecord }); // avatar_base_id = healer_male_01
        mockGetInventoryItem.mockResolvedValueOnce({ student_id: "student-001" });
        mockGetShopItem.mockResolvedValueOnce({ category: "HELMET", gender: "FEMALE" }); // FEMALE item
        mockGetAvatarBase.mockResolvedValueOnce({ avatar_base_id: "healer_male_01", gender: "MALE" }); // MALE avatar

        const res = await equipHandler(
            makeEvent(
                { pathParameters: { equipped_id: "equipped-uuid-001" } },
                { slot: "helmet", item_id: "helmet_female_only" }
            ) as any
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toMatch(/gender/);
    });

    it("returns 404 when EquippedItems record not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const res = await equipHandler(
            makeEvent(
                { pathParameters: { equipped_id: "ghost" } },
                { slot: "helmet", item_id: "helmet_iron_01" }
            ) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 8. unequip handler
// ---------------------------------------------------------------------------
describe("unequip handler", () => {
    it("unequips slot and resets to AvatarBases default", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeRecordRaw() }); // getEquippedItemsById
        mockGetAvatarBase.mockResolvedValueOnce({                  // getAvatarBase
            avatar_base_id:         "healer_male_01",
            default_helmet_item_id: "helmet_healer_default",
        });
        mockSend.mockResolvedValueOnce({                           // updateEquippedItems
            Attributes: makeRecordRaw({ helmet_item_id: "helmet_healer_default" }),
        });

        const res = await unequipHandler(
            makeEvent(
                { pathParameters: { equipped_id: "equipped-uuid-001" } },
                { slot: "helmet" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.reset_to).toBe("helmet_healer_default");
        expect(body.unequipped_slot).toBe("helmet");
    });

    it("unequips slot with no default — clears field (reset_to = null)", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeRecordRaw() }); // getEquippedItemsById
        mockGetAvatarBase.mockResolvedValueOnce({
            avatar_base_id: "healer_male_01",
            // no default_pet_item_id
        });
        mockSend.mockResolvedValueOnce({                           // clearSlotField
            Attributes: makeRecordRaw({ pet_item_id: undefined }),
        });

        const res = await unequipHandler(
            makeEvent(
                { pathParameters: { equipped_id: "equipped-uuid-001" } },
                { slot: "pet" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).reset_to).toBeNull();
        expect(JSON.parse(res.body).unequipped_slot).toBe("pet");
    });

    it("returns 400 for invalid slot", async () => {
        const res = await unequipHandler(
            makeEvent(
                { pathParameters: { equipped_id: "equipped-uuid-001" } },
                { slot: "wings" }
            ) as any
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 when EquippedItems record not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const res = await unequipHandler(
            makeEvent(
                { pathParameters: { equipped_id: "ghost" } },
                { slot: "helmet" }
            ) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

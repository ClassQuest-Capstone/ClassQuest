/**
 * Unit tests for the InventoryItems feature.
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
    DeleteCommand: vi.fn(function (input: any) { return { input }; }),
}));

// Mock crypto.randomUUID
vi.mock("crypto", () => ({
    randomUUID: vi.fn(() => "test-uuid-1234"),
}));

// ---------------------------------------------------------------------------
// Module references — populated in beforeAll
// ---------------------------------------------------------------------------
let keysModule:           typeof import("../keys.ts");
let validationModule:     typeof import("../validation.ts");
let createHandler:        (typeof import("../create.ts"))["handler"];
let getHandler:           (typeof import("../get.ts"))["handler"];
let listByStudentHandler: (typeof import("../list-by-student.ts"))["handler"];
let listByClassHandler:   (typeof import("../list-by-class.ts"))["handler"];
let listOwnersHandler:    (typeof import("../list-by-item-owners.ts"))["handler"];
let updateHandler:        (typeof import("../update.ts"))["handler"];
let deleteHandler:        (typeof import("../delete.ts"))["handler"];
let grantHandler:         (typeof import("../grant.ts"))["handler"];
let checkOwnsHandler:     (typeof import("../check-owns.ts"))["handler"];

beforeAll(async () => {
    process.env.INVENTORY_ITEMS_TABLE_NAME = "test-inventory-items";

    keysModule           = await import("../keys.ts");
    validationModule     = await import("../validation.ts");
    createHandler        = (await import("../create.ts")).handler;
    getHandler           = (await import("../get.ts")).handler;
    listByStudentHandler = (await import("../list-by-student.ts")).handler;
    listByClassHandler   = (await import("../list-by-class.ts")).handler;
    listOwnersHandler    = (await import("../list-by-item-owners.ts")).handler;
    updateHandler        = (await import("../update.ts")).handler;
    deleteHandler        = (await import("../delete.ts")).handler;
    grantHandler         = (await import("../grant.ts")).handler;
    checkOwnsHandler     = (await import("../check-owns.ts")).handler;
});

beforeEach(() => { mockSend.mockReset(); });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeItemRaw(overrides: Record<string, any> = {}) {
    return {
        PK:                "STUDENT#student_123",
        SK:                "ITEM#hat_iron_01",
        inventory_item_id: "inv_001",
        student_id:        "student_123",
        class_id:          "class_456",
        item_id:           "hat_iron_01",
        quantity:          1,
        acquired_from:     "SHOP_PURCHASE",
        acquired_at:       "2026-03-12T18:30:00Z",
        updated_at:        "2026-03-12T18:30:00Z",
        GSI1PK:            "CLASS#class_456",
        GSI1SK:            "STUDENT#student_123#ITEM#hat_iron_01",
        GSI2PK:            "ITEM#hat_iron_01",
        GSI2SK:            "CLASS#class_456#STUDENT#student_123",
        ...overrides,
    };
}

function makeEvent(overrides: Record<string, any> = {}) {
    return {
        pathParameters:       {},
        queryStringParameters:{},
        body: null,
        ...overrides,
    } as any;
}

// ---------------------------------------------------------------------------
// Keys tests
// ---------------------------------------------------------------------------
describe("keys", () => {
    it("buildInventoryItemPk", () => {
        expect(keysModule.buildInventoryItemPk("student_123")).toBe("STUDENT#student_123");
    });

    it("buildInventoryItemSk", () => {
        expect(keysModule.buildInventoryItemSk("hat_iron_01")).toBe("ITEM#hat_iron_01");
    });

    it("buildInventoryItemGsi1Pk", () => {
        expect(keysModule.buildInventoryItemGsi1Pk("class_456")).toBe("CLASS#class_456");
    });

    it("buildInventoryItemGsi1Sk", () => {
        expect(keysModule.buildInventoryItemGsi1Sk("student_123", "hat_iron_01"))
            .toBe("STUDENT#student_123#ITEM#hat_iron_01");
    });

    it("buildInventoryItemGsi2Pk", () => {
        expect(keysModule.buildInventoryItemGsi2Pk("hat_iron_01")).toBe("ITEM#hat_iron_01");
    });

    it("buildInventoryItemGsi2Sk", () => {
        expect(keysModule.buildInventoryItemGsi2Sk("class_456", "student_123"))
            .toBe("CLASS#class_456#STUDENT#student_123");
    });

    it("buildAllInventoryKeys", () => {
        const keys = keysModule.buildAllInventoryKeys({
            student_id: "student_123",
            class_id:   "class_456",
            item_id:    "hat_iron_01",
        });
        expect(keys.PK).toBe("STUDENT#student_123");
        expect(keys.SK).toBe("ITEM#hat_iron_01");
        expect(keys.GSI1PK).toBe("CLASS#class_456");
        expect(keys.GSI1SK).toBe("STUDENT#student_123#ITEM#hat_iron_01");
        expect(keys.GSI2PK).toBe("ITEM#hat_iron_01");
        expect(keys.GSI2SK).toBe("CLASS#class_456#STUDENT#student_123");
    });
});

// ---------------------------------------------------------------------------
// Validation tests
// ---------------------------------------------------------------------------
describe("validateInventoryItem", () => {
    it("rejects quantity = 0", () => {
        const r = validationModule.validateInventoryItem({ quantity: 0 });
        expect(r.valid).toBe(false);
        if (!r.valid) expect(r.error).toMatch(/quantity/);
    });

    it("rejects quantity = -1", () => {
        const r = validationModule.validateInventoryItem({ quantity: -1 });
        expect(r.valid).toBe(false);
    });

    it("accepts quantity = 1", () => {
        const r = validationModule.validateInventoryItem({ quantity: 1 });
        expect(r.valid).toBe(true);
    });

    it("rejects invalid acquired_from", () => {
        const r = validationModule.validateInventoryItem({ acquired_from: "STOLEN" });
        expect(r.valid).toBe(false);
    });

    it("accepts all valid acquired_from values", () => {
        for (const v of ["SHOP_PURCHASE", "QUEST_REWARD", "BOSS_REWARD", "ADMIN_GRANT", "SYSTEM_MIGRATION"]) {
            const r = validationModule.validateInventoryItem({ acquired_from: v });
            expect(r.valid).toBe(true);
        }
    });

    it("rejects invalid acquired_at timestamp", () => {
        const r = validationModule.validateInventoryItem({ acquired_at: "not-a-date" });
        expect(r.valid).toBe(false);
    });

    it("rejects student_id with spaces", () => {
        const r = validationModule.validateInventoryItem({ student_id: "bad id" });
        expect(r.valid).toBe(false);
    });

    it("accepts valid full input", () => {
        const r = validationModule.validateInventoryItem({
            student_id:    "student_123",
            class_id:      "class_456",
            item_id:       "hat_iron_01",
            quantity:      1,
            acquired_from: "ADMIN_GRANT",
            acquired_at:   "2026-03-12T18:30:00Z",
        });
        expect(r.valid).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// createInventoryItem handler tests
// ---------------------------------------------------------------------------
describe("createInventoryItem", () => {
    it("creates ownership record successfully", async () => {
        mockSend.mockResolvedValueOnce({});

        const event = makeEvent({
            body: JSON.stringify({
                student_id:    "student_123",
                class_id:      "class_456",
                item_id:       "hat_iron_01",
                quantity:      1,
                acquired_from: "ADMIN_GRANT",
            }),
        });

        const res = await createHandler(event);
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.student_id).toBe("student_123");
        expect(body.item_id).toBe("hat_iron_01");
    });

    it("returns 409 when student already owns item", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const event = makeEvent({
            body: JSON.stringify({
                student_id:    "student_123",
                class_id:      "class_456",
                item_id:       "hat_iron_01",
                quantity:      1,
                acquired_from: "ADMIN_GRANT",
            }),
        });

        const res = await createHandler(event);
        expect(res.statusCode).toBe(409);
    });

    it("returns 400 for quantity = 0", async () => {
        const event = makeEvent({
            body: JSON.stringify({
                student_id:    "student_123",
                class_id:      "class_456",
                item_id:       "hat_iron_01",
                quantity:      0,
                acquired_from: "ADMIN_GRANT",
            }),
        });

        const res = await createHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 for missing required fields", async () => {
        const event = makeEvent({
            body: JSON.stringify({ student_id: "student_123" }),
        });

        const res = await createHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// getInventoryItem handler tests
// ---------------------------------------------------------------------------
describe("getInventoryItem", () => {
    it("returns 200 with the item", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeItemRaw() });

        const event = makeEvent({
            pathParameters: { student_id: "student_123", item_id: "hat_iron_01" },
        });
        const res = await getHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.student_id).toBe("student_123");
        expect(body.item_id).toBe("hat_iron_01");
    });

    it("returns 404 when not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });

        const event = makeEvent({
            pathParameters: { student_id: "student_123", item_id: "missing" },
        });
        const res = await getHandler(event);
        expect(res.statusCode).toBe(404);
    });

    it("returns 400 when path params missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await getHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// listStudentInventoryItems handler tests
// ---------------------------------------------------------------------------
describe("listStudentInventoryItems", () => {
    it("returns all items for a student", async () => {
        const items = [makeItemRaw(), makeItemRaw({ item_id: "pet_wisp_01", SK: "ITEM#pet_wisp_01" })];
        mockSend.mockResolvedValueOnce({ Items: items });

        const event = makeEvent({ pathParameters: { student_id: "student_123" } });
        const res = await listByStudentHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.count).toBe(2);
    });

    it("queries PK = STUDENT#{student_id}", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        const event = makeEvent({ pathParameters: { student_id: "student_123" } });
        await listByStudentHandler(event);

        const call = mockSend.mock.calls[0][0];
        expect(call.input.ExpressionAttributeValues[":pk"]).toBe("STUDENT#student_123");
    });

    it("returns 400 when student_id missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await listByStudentHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// listClassInventoryItems handler tests
// ---------------------------------------------------------------------------
describe("listClassInventoryItems", () => {
    it("returns items for a class", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeItemRaw()] });

        const event = makeEvent({ pathParameters: { class_id: "class_456" } });
        const res = await listByClassHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.count).toBe(1);
    });

    it("queries GSI1PK = CLASS#{class_id}", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        const event = makeEvent({ pathParameters: { class_id: "class_456" } });
        await listByClassHandler(event);

        const call = mockSend.mock.calls[0][0];
        expect(call.input.ExpressionAttributeValues[":pk"]).toBe("CLASS#class_456");
    });

    it("filters by student when student_id provided in path", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeItemRaw()] });

        const event = makeEvent({
            pathParameters: { class_id: "class_456", student_id: "student_123" },
        });
        const res = await listByClassHandler(event);
        expect(res.statusCode).toBe(200);

        const call = mockSend.mock.calls[0][0];
        expect(call.input.ExpressionAttributeValues[":prefix"]).toBe("STUDENT#student_123#");
    });

    it("returns 400 when class_id missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await listByClassHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// listInventoryOwnersByItem handler tests
// ---------------------------------------------------------------------------
describe("listInventoryOwnersByItem", () => {
    it("returns all owners of an item", async () => {
        const owners = [
            makeItemRaw(),
            makeItemRaw({ student_id: "student_999", PK: "STUDENT#student_999", GSI2SK: "CLASS#class_456#STUDENT#student_999" }),
        ];
        mockSend.mockResolvedValueOnce({ Items: owners });

        const event = makeEvent({ pathParameters: { item_id: "hat_iron_01" } });
        const res = await listOwnersHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.count).toBe(2);
    });

    it("queries GSI2PK = ITEM#{item_id}", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        const event = makeEvent({ pathParameters: { item_id: "hat_iron_01" } });
        await listOwnersHandler(event);

        const call = mockSend.mock.calls[0][0];
        expect(call.input.ExpressionAttributeValues[":pk"]).toBe("ITEM#hat_iron_01");
    });

    it("returns 400 when item_id missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await listOwnersHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// updateInventoryItem handler tests
// ---------------------------------------------------------------------------
describe("updateInventoryItem", () => {
    it("updates quantity successfully", async () => {
        const updated = makeItemRaw({ quantity: 3 });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        const event = makeEvent({
            pathParameters: { student_id: "student_123", item_id: "hat_iron_01" },
            body: JSON.stringify({ quantity: 3 }),
        });

        const res = await updateHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.quantity).toBe(3);
    });

    it("correctly rebuilds GSI keys when class_id changes", async () => {
        const current = makeItemRaw();
        const updated = makeItemRaw({
            class_id: "class_new",
            GSI1PK:   "CLASS#class_new",
            GSI1SK:   "STUDENT#student_123#ITEM#hat_iron_01",
            GSI2SK:   "CLASS#class_new#STUDENT#student_123",
        });

        mockSend
            .mockResolvedValueOnce({ Item: current })   // getInventoryItem (fetch for key rebuild)
            .mockResolvedValueOnce({ Attributes: updated }); // updateInventoryItem

        const event = makeEvent({
            pathParameters: { student_id: "student_123", item_id: "hat_iron_01" },
            body: JSON.stringify({ class_id: "class_new" }),
        });

        const res = await updateHandler(event);
        expect(res.statusCode).toBe(200);

        const updateCall = mockSend.mock.calls[1][0];
        expect(updateCall.input.ExpressionAttributeValues[":GSI1PK"]).toBe("CLASS#class_new");
        expect(updateCall.input.ExpressionAttributeValues[":GSI2SK"]).toBe("CLASS#class_new#STUDENT#student_123");
    });

    it("returns 400 for no updatable fields", async () => {
        const event = makeEvent({
            pathParameters: { student_id: "student_123", item_id: "hat_iron_01" },
            body: JSON.stringify({}),
        });
        const res = await updateHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 when item not found", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const event = makeEvent({
            pathParameters: { student_id: "student_123", item_id: "missing" },
            body: JSON.stringify({ quantity: 2 }),
        });

        const res = await updateHandler(event);
        expect(res.statusCode).toBe(404);
    });

    it("returns 400 for invalid quantity", async () => {
        const event = makeEvent({
            pathParameters: { student_id: "student_123", item_id: "hat_iron_01" },
            body: JSON.stringify({ quantity: -5 }),
        });
        const res = await updateHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// deleteInventoryItem handler tests
// ---------------------------------------------------------------------------
describe("deleteInventoryItem", () => {
    it("deletes successfully", async () => {
        mockSend.mockResolvedValueOnce({});

        const event = makeEvent({
            pathParameters: { student_id: "student_123", item_id: "hat_iron_01" },
        });
        const res = await deleteHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.message).toMatch(/deleted/i);
    });

    it("returns 404 when item not found", async () => {
        const err = new Error("Condition failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const event = makeEvent({
            pathParameters: { student_id: "student_123", item_id: "missing" },
        });
        const res = await deleteHandler(event);
        expect(res.statusCode).toBe(404);
    });

    it("returns 400 when path params missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await deleteHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// grantInventoryItem handler tests
// ---------------------------------------------------------------------------
describe("grantInventoryItem", () => {
    it("creates new ownership when item not owned (201)", async () => {
        mockSend.mockResolvedValueOnce({}); // createInventoryItem succeeds

        const event = makeEvent({
            body: JSON.stringify({
                student_id: "student_123",
                class_id:   "class_456",
                item_id:    "hat_iron_01",
            }),
        });

        const res = await grantHandler(event);
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.action).toBe("created");
        expect(body.quantity).toBe(1);
    });

    it("increments quantity when item already owned (200)", async () => {
        const conflictErr = new Error("Condition failed");
        conflictErr.name = "ConditionalCheckFailedException";

        const updated = makeItemRaw({ quantity: 2 });

        mockSend
            .mockRejectedValueOnce(conflictErr)          // createInventoryItem → conflict
            .mockResolvedValueOnce({ Attributes: updated }); // incrementQuantity

        const event = makeEvent({
            body: JSON.stringify({
                student_id: "student_123",
                class_id:   "class_456",
                item_id:    "hat_iron_01",
            }),
        });

        const res = await grantHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.action).toBe("incremented");
        expect(body.quantity).toBe(2);
    });

    it("uses custom quantity when provided", async () => {
        mockSend.mockResolvedValueOnce({});

        const event = makeEvent({
            body: JSON.stringify({
                student_id: "student_123",
                class_id:   "class_456",
                item_id:    "hat_iron_01",
                quantity:   5,
            }),
        });

        const res = await grantHandler(event);
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.quantity).toBe(5);
    });

    it("returns 400 for missing required fields", async () => {
        const event = makeEvent({
            body: JSON.stringify({ student_id: "student_123" }),
        });
        const res = await grantHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// checkStudentOwnsItem handler tests
// ---------------------------------------------------------------------------
describe("checkStudentOwnsItem", () => {
    it("returns owned=true with quantity when item exists", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeItemRaw({ quantity: 2 }) });

        const event = makeEvent({
            pathParameters: { student_id: "student_123", item_id: "hat_iron_01" },
        });
        const res = await checkOwnsHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.owned).toBe(true);
        expect(body.quantity).toBe(2);
        expect(body.inventory_item_id).toBe("inv_001");
    });

    it("returns owned=false when item not owned", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });

        const event = makeEvent({
            pathParameters: { student_id: "student_123", item_id: "missing" },
        });
        const res = await checkOwnsHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.owned).toBe(false);
        expect(body.quantity).toBe(0);
    });

    it("returns 400 when path params missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await checkOwnsHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

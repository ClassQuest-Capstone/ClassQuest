/**
 * Unit tests for the ShopListings feature.
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
    PutCommand:           vi.fn(function (input: any) { return { input }; }),
    GetCommand:           vi.fn(function (input: any) { return { input }; }),
    QueryCommand:         vi.fn(function (input: any) { return { input }; }),
    UpdateCommand:        vi.fn(function (input: any) { return { input }; }),
    DeleteCommand:        vi.fn(function (input: any) { return { input }; }),
    ScanCommand:          vi.fn(function (input: any) { return { input }; }),
    TransactWriteCommand: vi.fn(function (input: any) { return { input }; }),
}));

// ---------------------------------------------------------------------------
// Module references — populated in beforeAll
// ---------------------------------------------------------------------------
let keysModule:           typeof import("../keys.ts");
let validationModule:     typeof import("../validation.ts");
let repoModule:           typeof import("../repo.ts");
let createHandler:        (typeof import("../create.ts"))["handler"];
let getHandler:           (typeof import("../get.ts"))["handler"];
let listAllHandler:       (typeof import("../list-all.ts"))["handler"];
let listActiveHandler:    (typeof import("../list-active.ts"))["handler"];
let listGlobalHandler:    (typeof import("../list-global.ts"))["handler"];
let listByClassHandler:   (typeof import("../list-by-class.ts"))["handler"];
let listByItemHandler:    (typeof import("../list-by-item.ts"))["handler"];
let updateHandler:        (typeof import("../update.ts"))["handler"];
let activateHandler:      (typeof import("../activate.ts"))["handler"];
let deactivateHandler:    (typeof import("../deactivate.ts"))["handler"];

beforeAll(async () => {
    process.env.SHOP_LISTINGS_TABLE_NAME = "test-shop-listings";

    keysModule        = await import("../keys.ts");
    validationModule  = await import("../validation.ts");
    repoModule        = await import("../repo.ts");
    createHandler     = (await import("../create.ts")).handler;
    getHandler        = (await import("../get.ts")).handler;
    listAllHandler    = (await import("../list-all.ts")).handler;
    listActiveHandler = (await import("../list-active.ts")).handler;
    listGlobalHandler = (await import("../list-global.ts")).handler;
    listByClassHandler= (await import("../list-by-class.ts")).handler;
    listByItemHandler = (await import("../list-by-item.ts")).handler;
    updateHandler     = (await import("../update.ts")).handler;
    activateHandler   = (await import("../activate.ts")).handler;
    deactivateHandler = (await import("../deactivate.ts")).handler;
});

beforeEach(() => { mockSend.mockReset(); });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeListingRaw(overrides: Record<string, any> = {}) {
    return {
        PK:                        "SHOP#GLOBAL",
        SK:                        "ACTIVEFROM#2026-03-15T00:00:00Z#LISTING#listing_001",
        shop_listing_id:           "listing_001",
        item_id:                   "hat_iron_01",
        available_from:            "2026-03-15T00:00:00Z",
        available_to:              "2026-03-31T23:59:59Z",
        is_active:                 true,
        listing_status:            "ACTIVE",
        GSI1PK:                    "SHOPVIEW#GLOBAL#ACTIVE",
        GSI1SK:                    "FROM#2026-03-15T00:00:00Z#TO#2026-03-31T23:59:59Z#ITEM#hat_iron_01#LISTING#listing_001",
        GSI2PK:                    "ITEM#hat_iron_01",
        GSI2SK:                    "SHOP#GLOBAL#FROM#2026-03-15T00:00:00Z#LISTING#listing_001",
        purchase_limit_per_student: 1,
        created_at:                "2026-03-12T12:00:00Z",
        updated_at:                "2026-03-12T12:00:00Z",
        ...overrides,
    };
}

function makeClassListingRaw(overrides: Record<string, any> = {}) {
    return makeListingRaw({
        PK:             "SHOP#CLASS#class_123",
        SK:             "ACTIVEFROM#2026-04-01T00:00:00Z#LISTING#listing_002",
        shop_listing_id:"listing_002",
        item_id:        "pet_wisp_01",
        class_id:       "class_123",
        available_from: "2026-04-01T00:00:00Z",
        available_to:   "2026-04-07T23:59:59Z",
        is_active:      false,
        listing_status: "INACTIVE",
        GSI1PK:         "SHOPVIEW#CLASS#class_123#INACTIVE",
        GSI1SK:         "FROM#2026-04-01T00:00:00Z#TO#2026-04-07T23:59:59Z#ITEM#pet_wisp_01#LISTING#listing_002",
        GSI2PK:         "ITEM#pet_wisp_01",
        GSI2SK:         "SHOP#CLASS#class_123#FROM#2026-04-01T00:00:00Z#LISTING#listing_002",
        ...overrides,
    });
}

function makeEvent(overrides: Record<string, any> = {}) {
    return {
        pathParameters: {},
        queryStringParameters: {},
        body: null,
        ...overrides,
    } as any;
}

// ---------------------------------------------------------------------------
// Keys tests
// ---------------------------------------------------------------------------
describe("keys", () => {
    it("buildShopListingPk — global (no class_id)", () => {
        expect(keysModule.buildShopListingPk()).toBe("SHOP#GLOBAL");
        expect(keysModule.buildShopListingPk(null)).toBe("SHOP#GLOBAL");
        expect(keysModule.buildShopListingPk(undefined)).toBe("SHOP#GLOBAL");
    });

    it("buildShopListingPk — class listing", () => {
        expect(keysModule.buildShopListingPk("class_123")).toBe("SHOP#CLASS#class_123");
    });

    it("buildShopListingSk", () => {
        expect(
            keysModule.buildShopListingSk("2026-03-15T00:00:00Z", "listing_001")
        ).toBe("ACTIVEFROM#2026-03-15T00:00:00Z#LISTING#listing_001");
    });

    it("buildShopListingStatus", () => {
        expect(keysModule.buildShopListingStatus(true)).toBe("ACTIVE");
        expect(keysModule.buildShopListingStatus(false)).toBe("INACTIVE");
    });

    it("buildGsi1Pk — global active", () => {
        expect(keysModule.buildGsi1Pk(null, true)).toBe("SHOPVIEW#GLOBAL#ACTIVE");
    });

    it("buildGsi1Pk — global inactive", () => {
        expect(keysModule.buildGsi1Pk(undefined, false)).toBe("SHOPVIEW#GLOBAL#INACTIVE");
    });

    it("buildGsi1Pk — class active", () => {
        expect(keysModule.buildGsi1Pk("class_123", true)).toBe("SHOPVIEW#CLASS#class_123#ACTIVE");
    });

    it("buildGsi1Pk — class inactive", () => {
        expect(keysModule.buildGsi1Pk("class_123", false)).toBe("SHOPVIEW#CLASS#class_123#INACTIVE");
    });

    it("buildGsi1Sk", () => {
        expect(
            keysModule.buildGsi1Sk(
                "2026-03-15T00:00:00Z",
                "2026-03-31T23:59:59Z",
                "hat_iron_01",
                "listing_001"
            )
        ).toBe("FROM#2026-03-15T00:00:00Z#TO#2026-03-31T23:59:59Z#ITEM#hat_iron_01#LISTING#listing_001");
    });

    it("buildGsi2Pk", () => {
        expect(keysModule.buildGsi2Pk("hat_iron_01")).toBe("ITEM#hat_iron_01");
    });

    it("buildGsi2Sk — global listing", () => {
        expect(
            keysModule.buildGsi2Sk(null, "2026-03-15T00:00:00Z", "listing_001")
        ).toBe("SHOP#GLOBAL#FROM#2026-03-15T00:00:00Z#LISTING#listing_001");
    });

    it("buildGsi2Sk — class listing", () => {
        expect(
            keysModule.buildGsi2Sk("class_123", "2026-04-01T00:00:00Z", "listing_002")
        ).toBe("SHOP#CLASS#class_123#FROM#2026-04-01T00:00:00Z#LISTING#listing_002");
    });

    it("buildAllListingKeys — global active", () => {
        const keys = keysModule.buildAllListingKeys({
            shop_listing_id: "listing_001",
            class_id:        null,
            item_id:         "hat_iron_01",
            available_from:  "2026-03-15T00:00:00Z",
            available_to:    "2026-03-31T23:59:59Z",
            is_active:       true,
        });
        expect(keys.PK).toBe("SHOP#GLOBAL");
        expect(keys.SK).toBe("ACTIVEFROM#2026-03-15T00:00:00Z#LISTING#listing_001");
        expect(keys.listing_status).toBe("ACTIVE");
        expect(keys.GSI1PK).toBe("SHOPVIEW#GLOBAL#ACTIVE");
        expect(keys.GSI1SK).toBe("FROM#2026-03-15T00:00:00Z#TO#2026-03-31T23:59:59Z#ITEM#hat_iron_01#LISTING#listing_001");
        expect(keys.GSI2PK).toBe("ITEM#hat_iron_01");
        expect(keys.GSI2SK).toBe("SHOP#GLOBAL#FROM#2026-03-15T00:00:00Z#LISTING#listing_001");
    });

    it("buildAllListingKeys — class inactive", () => {
        const keys = keysModule.buildAllListingKeys({
            shop_listing_id: "listing_002",
            class_id:        "class_123",
            item_id:         "pet_wisp_01",
            available_from:  "2026-04-01T00:00:00Z",
            available_to:    "2026-04-07T23:59:59Z",
            is_active:       false,
        });
        expect(keys.PK).toBe("SHOP#CLASS#class_123");
        expect(keys.listing_status).toBe("INACTIVE");
        expect(keys.GSI1PK).toBe("SHOPVIEW#CLASS#class_123#INACTIVE");
        expect(keys.GSI2SK).toBe("SHOP#CLASS#class_123#FROM#2026-04-01T00:00:00Z#LISTING#listing_002");
    });
});

// ---------------------------------------------------------------------------
// Validation tests
// ---------------------------------------------------------------------------
describe("validateShopListing", () => {
    it("rejects listing_status being supplied", () => {
        const r = validationModule.validateShopListing({ listing_status: "ACTIVE" } as any);
        expect(r.valid).toBe(false);
    });

    it("rejects empty shop_listing_id", () => {
        const r = validationModule.validateShopListing({ shop_listing_id: "" });
        expect(r.valid).toBe(false);
    });

    it("rejects unsafe characters in shop_listing_id", () => {
        const r = validationModule.validateShopListing({ shop_listing_id: "bad id!" });
        expect(r.valid).toBe(false);
    });

    it("rejects invalid available_from", () => {
        const r = validationModule.validateShopListing({ available_from: "not-a-date" });
        expect(r.valid).toBe(false);
    });

    it("rejects available_to < available_from", () => {
        const r = validationModule.validateShopListing({
            available_from: "2026-04-10T00:00:00Z",
            available_to:   "2026-04-01T00:00:00Z",
        });
        expect(r.valid).toBe(false);
        if (!r.valid) expect(r.error).toMatch(/available_to/);
    });

    it("accepts available_to == available_from", () => {
        const r = validationModule.validateShopListing({
            available_from: "2026-04-01T00:00:00Z",
            available_to:   "2026-04-01T00:00:00Z",
        });
        expect(r.valid).toBe(true);
    });

    it("rejects purchase_limit_per_student = 0", () => {
        const r = validationModule.validateShopListing({ purchase_limit_per_student: 0 });
        expect(r.valid).toBe(false);
    });

    it("accepts purchase_limit_per_student = 1", () => {
        const r = validationModule.validateShopListing({ purchase_limit_per_student: 1 });
        expect(r.valid).toBe(true);
    });

    it("rejects non-boolean is_active", () => {
        const r = validationModule.validateShopListing({ is_active: "yes" as any });
        expect(r.valid).toBe(false);
    });

    it("accepts valid full input", () => {
        const r = validationModule.validateShopListing({
            shop_listing_id: "listing_001",
            item_id: "hat_iron_01",
            available_from: "2026-03-15T00:00:00Z",
            available_to:   "2026-03-31T23:59:59Z",
            is_active: true,
            class_id: "class_123",
            purchase_limit_per_student: 3,
            display_order: 1,
        });
        expect(r.valid).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// createShopListing handler tests
// ---------------------------------------------------------------------------
describe("createShopListing", () => {
    it("creates a global listing successfully", async () => {
        mockSend.mockResolvedValueOnce({});

        const event = makeEvent({
            body: JSON.stringify({
                shop_listing_id: "listing_001",
                item_id:         "hat_iron_01",
                available_from:  "2026-03-15T00:00:00Z",
                available_to:    "2026-03-31T23:59:59Z",
                is_active:       true,
            }),
        });

        const res = await createHandler(event);
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.shop_listing_id).toBe("listing_001");
    });

    it("creates a class-specific listing successfully", async () => {
        mockSend.mockResolvedValueOnce({});

        const event = makeEvent({
            body: JSON.stringify({
                shop_listing_id: "listing_002",
                item_id:         "pet_wisp_01",
                available_from:  "2026-04-01T00:00:00Z",
                available_to:    "2026-04-07T23:59:59Z",
                is_active:       false,
                class_id:        "class_123",
                purchase_limit_per_student: 2,
            }),
        });

        const res = await createHandler(event);
        expect(res.statusCode).toBe(201);
    });

    it("returns 409 on duplicate listing", async () => {
        const err = new Error("Conditional check failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const event = makeEvent({
            body: JSON.stringify({
                shop_listing_id: "listing_001",
                item_id:         "hat_iron_01",
                available_from:  "2026-03-15T00:00:00Z",
                available_to:    "2026-03-31T23:59:59Z",
                is_active:       true,
            }),
        });

        const res = await createHandler(event);
        expect(res.statusCode).toBe(409);
    });

    it("returns 400 when available_to < available_from", async () => {
        const event = makeEvent({
            body: JSON.stringify({
                shop_listing_id: "listing_x",
                item_id:         "hat_iron_01",
                available_from:  "2026-04-10T00:00:00Z",
                available_to:    "2026-04-01T00:00:00Z",
                is_active:       true,
            }),
        });

        const res = await createHandler(event);
        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toMatch(/available_to/);
    });

    it("returns 400 for missing required fields", async () => {
        const event = makeEvent({
            body: JSON.stringify({ shop_listing_id: "listing_x" }),
        });

        const res = await createHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// getShopListing handler tests
// ---------------------------------------------------------------------------
describe("getShopListing", () => {
    it("returns 200 with the listing", async () => {
        const raw = makeListingRaw();
        mockSend.mockResolvedValueOnce({ Items: [raw], Count: 1 });

        const event = makeEvent({ pathParameters: { shop_listing_id: "listing_001" } });
        const res = await getHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.shop_listing_id).toBe("listing_001");
    });

    it("returns 404 when not found", async () => {
        mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });

        const event = makeEvent({ pathParameters: { shop_listing_id: "missing" } });
        const res = await getHandler(event);
        expect(res.statusCode).toBe(404);
    });

    it("returns 400 for missing path param", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await getHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// listActiveShopListings handler tests
// ---------------------------------------------------------------------------
describe("listActiveShopListings", () => {
    it("returns only manually active (global) listings", async () => {
        const active = makeListingRaw();
        mockSend.mockResolvedValueOnce({ Items: [active] });

        const event = makeEvent();
        const res = await listActiveHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.items[0].is_active).toBe(true);
    });

    it("queries GSI1 with SHOPVIEW#GLOBAL#ACTIVE partition key", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        const event = makeEvent();
        await listActiveHandler(event);

        const call = mockSend.mock.calls[0][0];
        expect(call.input.ExpressionAttributeValues[":pk"]).toBe("SHOPVIEW#GLOBAL#ACTIVE");
    });
});

// ---------------------------------------------------------------------------
// listGlobalShopListings handler tests
// ---------------------------------------------------------------------------
describe("listGlobalShopListings", () => {
    it("queries SHOPVIEW#GLOBAL#ACTIVE by default", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        const event = makeEvent();
        await listGlobalHandler(event);

        const call = mockSend.mock.calls[0][0];
        expect(call.input.ExpressionAttributeValues[":pk"]).toBe("SHOPVIEW#GLOBAL#ACTIVE");
    });

    it("queries SHOPVIEW#GLOBAL#INACTIVE when active_only=false", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        const event = makeEvent({ queryStringParameters: { active_only: "false" } });
        await listGlobalHandler(event);

        const call = mockSend.mock.calls[0][0];
        expect(call.input.ExpressionAttributeValues[":pk"]).toBe("SHOPVIEW#GLOBAL#INACTIVE");
    });
});

// ---------------------------------------------------------------------------
// listClassShopListings handler tests
// ---------------------------------------------------------------------------
describe("listClassShopListings", () => {
    it("returns only listings for the requested class", async () => {
        const classListing = makeClassListingRaw({ is_active: true, listing_status: "ACTIVE", GSI1PK: "SHOPVIEW#CLASS#class_123#ACTIVE" });
        mockSend.mockResolvedValueOnce({ Items: [classListing] });

        const event = makeEvent({ pathParameters: { class_id: "class_123" } });
        const res = await listByClassHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.items[0].class_id).toBe("class_123");
    });

    it("queries SHOPVIEW#CLASS#{class_id}#ACTIVE by default", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        const event = makeEvent({ pathParameters: { class_id: "class_abc" } });
        await listByClassHandler(event);

        const call = mockSend.mock.calls[0][0];
        expect(call.input.ExpressionAttributeValues[":pk"]).toBe("SHOPVIEW#CLASS#class_abc#ACTIVE");
    });

    it("returns 400 when class_id is missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await listByClassHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// listShopListingsByItem handler tests
// ---------------------------------------------------------------------------
describe("listShopListingsByItem", () => {
    it("returns all listings for the requested item", async () => {
        const r1 = makeListingRaw();
        const r2 = makeClassListingRaw();
        mockSend.mockResolvedValueOnce({ Items: [r1, r2] });

        const event = makeEvent({ pathParameters: { item_id: "hat_iron_01" } });
        const res = await listByItemHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.count).toBe(2);
    });

    it("queries GSI2 with ITEM#{item_id}", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        const event = makeEvent({ pathParameters: { item_id: "hat_iron_01" } });
        await listByItemHandler(event);

        const call = mockSend.mock.calls[0][0];
        expect(call.input.ExpressionAttributeValues[":pk"]).toBe("ITEM#hat_iron_01");
    });

    it("returns 400 when item_id is missing", async () => {
        const event = makeEvent({ pathParameters: {} });
        const res = await listByItemHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// updateShopListing handler tests
// ---------------------------------------------------------------------------
describe("updateShopListing", () => {
    it("returns 400 when no fields are provided", async () => {
        // First call: getListingById (GSI3 query)
        mockSend.mockResolvedValueOnce({ Items: [makeListingRaw()], Count: 1 });

        const event = makeEvent({
            pathParameters: { shop_listing_id: "listing_001" },
            body: JSON.stringify({}),
        });

        const res = await updateHandler(event);
        expect(res.statusCode).toBe(400);
    });

    it("performs in-place update when only available_to changes", async () => {
        mockSend
            .mockResolvedValueOnce({ Items: [makeListingRaw()], Count: 1 }) // getListingById
            .mockResolvedValueOnce({ Attributes: { ...makeListingRaw(), available_to: "2026-04-15T23:59:59Z" } }); // updateListingInPlace

        const event = makeEvent({
            pathParameters: { shop_listing_id: "listing_001" },
            body: JSON.stringify({ available_to: "2026-04-15T23:59:59Z" }),
        });

        const res = await updateHandler(event);
        expect(res.statusCode).toBe(200);
    });

    it("correctly rebuilds GSI keys when class_id changes (replace path)", async () => {
        mockSend
            .mockResolvedValueOnce({ Items: [makeListingRaw()], Count: 1 }) // getListingById
            .mockResolvedValueOnce({}); // TransactWrite (replaceListingRecord)

        const event = makeEvent({
            pathParameters: { shop_listing_id: "listing_001" },
            body: JSON.stringify({ class_id: "class_new" }),
        });

        const res = await updateHandler(event);
        expect(res.statusCode).toBe(200);

        // Verify the TransactWrite was called (second mock send)
        const call = mockSend.mock.calls[1][0];
        expect(call.input.TransactItems).toHaveLength(2);
        // New record should have updated PK
        const putItem = call.input.TransactItems[1].Put.Item;
        expect(putItem.PK).toBe("SHOP#CLASS#class_new");
        expect(putItem.GSI1PK).toBe("SHOPVIEW#CLASS#class_new#ACTIVE");
    });

    it("correctly rebuilds GSI keys when available_from changes (replace path)", async () => {
        mockSend
            .mockResolvedValueOnce({ Items: [makeListingRaw()], Count: 1 })
            .mockResolvedValueOnce({});

        const event = makeEvent({
            pathParameters: { shop_listing_id: "listing_001" },
            body: JSON.stringify({ available_from: "2026-04-01T00:00:00Z" }),
        });

        const res = await updateHandler(event);
        expect(res.statusCode).toBe(200);

        const call = mockSend.mock.calls[1][0];
        const putItem = call.input.TransactItems[1].Put.Item;
        expect(putItem.SK).toBe("ACTIVEFROM#2026-04-01T00:00:00Z#LISTING#listing_001");
    });

    it("returns 404 when listing not found", async () => {
        mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });

        const event = makeEvent({
            pathParameters: { shop_listing_id: "missing" },
            body: JSON.stringify({ available_to: "2026-05-01T00:00:00Z" }),
        });

        const res = await updateHandler(event);
        expect(res.statusCode).toBe(404);
    });

    it("returns 400 for invalid date range", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeListingRaw()], Count: 1 });

        const event = makeEvent({
            pathParameters: { shop_listing_id: "listing_001" },
            body: JSON.stringify({ available_to: "2026-01-01T00:00:00Z" }), // before available_from
        });

        const res = await updateHandler(event);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// activateShopListing handler tests
// ---------------------------------------------------------------------------
describe("activateShopListing", () => {
    it("flips is_active and GSI1PK to ACTIVE", async () => {
        const inactive = makeListingRaw({ is_active: false, listing_status: "INACTIVE", GSI1PK: "SHOPVIEW#GLOBAL#INACTIVE" });
        const activated = { ...inactive, is_active: true, listing_status: "ACTIVE", GSI1PK: "SHOPVIEW#GLOBAL#ACTIVE" };

        mockSend
            .mockResolvedValueOnce({ Items: [inactive], Count: 1 })  // getListingById
            .mockResolvedValueOnce({ Attributes: activated });         // setListingActiveStatus

        const event = makeEvent({ pathParameters: { shop_listing_id: "listing_001" } });
        const res = await activateHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.is_active).toBe(true);
        expect(body.listing_status).toBe("ACTIVE");
        expect(body.GSI1PK).toBe("SHOPVIEW#GLOBAL#ACTIVE");
    });

    it("returns 404 when listing not found", async () => {
        mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });

        const event = makeEvent({ pathParameters: { shop_listing_id: "missing" } });
        const res = await activateHandler(event);
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// deactivateShopListing handler tests
// ---------------------------------------------------------------------------
describe("deactivateShopListing", () => {
    it("flips is_active and GSI1PK to INACTIVE", async () => {
        const active = makeListingRaw();
        const deactivated = { ...active, is_active: false, listing_status: "INACTIVE", GSI1PK: "SHOPVIEW#GLOBAL#INACTIVE" };

        mockSend
            .mockResolvedValueOnce({ Items: [active], Count: 1 })
            .mockResolvedValueOnce({ Attributes: deactivated });

        const event = makeEvent({ pathParameters: { shop_listing_id: "listing_001" } });
        const res = await deactivateHandler(event);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.is_active).toBe(false);
        expect(body.listing_status).toBe("INACTIVE");
        expect(body.GSI1PK).toBe("SHOPVIEW#GLOBAL#INACTIVE");
    });

    it("returns 404 when listing not found", async () => {
        mockSend.mockResolvedValueOnce({ Items: [], Count: 0 });

        const event = makeEvent({ pathParameters: { shop_listing_id: "missing" } });
        const res = await deactivateHandler(event);
        expect(res.statusCode).toBe(404);
    });
});

/**
 * Unit tests for the ShopItems feature.
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
}));

// ---------------------------------------------------------------------------
// Module references — populated in beforeAll (env var must be set first)
// ---------------------------------------------------------------------------
let keysModule:      typeof import("../keys.ts");
let validationModule: typeof import("../validation.ts");
let repoModule:      typeof import("../repo.ts");
let createHandler:   (typeof import("../create.ts"))["handler"];
let getHandler:      (typeof import("../get.ts"))["handler"];
let listActiveHandler:     (typeof import("../list-active.ts"))["handler"];
let listByCategoryHandler: (typeof import("../list-by-category.ts"))["handler"];
let updateHandler:   (typeof import("../update.ts"))["handler"];
let deactivateHandler: (typeof import("../deactivate.ts"))["handler"];
let activateHandler:   (typeof import("../activate.ts"))["handler"];

beforeAll(async () => {
    process.env.SHOP_ITEMS_TABLE_NAME = "test-shop-items";

    keysModule        = await import("../keys.ts");
    validationModule  = await import("../validation.ts");
    repoModule        = await import("../repo.ts");
    createHandler     = (await import("../create.ts")).handler;
    getHandler        = (await import("../get.ts")).handler;
    listActiveHandler       = (await import("../list-active.ts")).handler;
    listByCategoryHandler   = (await import("../list-by-category.ts")).handler;
    updateHandler     = (await import("../update.ts")).handler;
    deactivateHandler = (await import("../deactivate.ts")).handler;
    activateHandler   = (await import("../activate.ts")).handler;
});

beforeEach(() => { mockSend.mockReset(); });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeItemRaw(overrides: Record<string, any> = {}) {
    return {
        item_pk:         "SHOPITEM#hat_iron_01",
        item_sk:         "META",
        item_id:         "hat_iron_01",
        name:            "Iron Helm",
        description:     "Basic iron helmet for new adventurers.",
        category:        "HAT",
        rarity:          "COMMON",
        gold_cost:       500,
        required_level:  5,
        is_cosmetic_only: false,
        sprite_path:     "/items/hats/iron_helm.png",
        is_active:       true,
        gsi1pk:          "SHOP#ACTIVE",
        gsi1sk:          "CATEGORY#HAT#LEVEL#005#PRICE#000500#RARITY#COMMON#ITEM#hat_iron_01",
        gsi2pk:          "CATEGORY#HAT",
        gsi2sk:          "LEVEL#005#PRICE#000500#ITEM#hat_iron_01",
        created_at:      "2026-01-01T00:00:00.000Z",
        updated_at:      "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeCreateBody(overrides: Record<string, any> = {}) {
    return {
        item_id:          "hat_iron_01",
        name:             "Iron Helm",
        description:      "Basic iron helmet for new adventurers.",
        category:         "HAT",
        rarity:           "COMMON",
        gold_cost:        500,
        required_level:   5,
        is_cosmetic_only: false,
        sprite_path:      "/items/hats/iron_helm.png",
        is_active:        true,
        ...overrides,
    };
}

function makeEvent(overrides: Record<string, any> = {}, body?: Record<string, any>) {
    return {
        pathParameters: {},
        queryStringParameters: {},
        body: body ? JSON.stringify(body) : undefined,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// 1. keys.ts — padding and GSI key builders
// ---------------------------------------------------------------------------
describe("keys — makeLevelPadded", () => {
    it("pads 0 to 3 digits", () => expect(keysModule.makeLevelPadded(0)).toBe("000"));
    it("pads 5 to 005",      () => expect(keysModule.makeLevelPadded(5)).toBe("005"));
    it("pads 100 to 100",    () => expect(keysModule.makeLevelPadded(100)).toBe("100"));
    it("pads 999 to 999",    () => expect(keysModule.makeLevelPadded(999)).toBe("999"));
    it("throws for negative", () =>
        expect(() => keysModule.makeLevelPadded(-1)).toThrow());
    it("throws for >999", () =>
        expect(() => keysModule.makeLevelPadded(1000)).toThrow());
});

describe("keys — makePricePadded", () => {
    it("pads 0 to 000000",      () => expect(keysModule.makePricePadded(0)).toBe("000000"));
    it("pads 500 to 000500",    () => expect(keysModule.makePricePadded(500)).toBe("000500"));
    it("pads 99999 to 099999",  () => expect(keysModule.makePricePadded(99999)).toBe("099999"));
    it("pads 999999 to 999999", () => expect(keysModule.makePricePadded(999999)).toBe("999999"));
    it("throws for negative",   () =>
        expect(() => keysModule.makePricePadded(-1)).toThrow());
    it("throws for >999999",    () =>
        expect(() => keysModule.makePricePadded(1000000)).toThrow());
});

describe("keys — makeGsi1Pk", () => {
    it("returns SHOP#ACTIVE for true",    () => expect(keysModule.makeGsi1Pk(true)).toBe("SHOP#ACTIVE"));
    it("returns SHOP#INACTIVE for false", () => expect(keysModule.makeGsi1Pk(false)).toBe("SHOP#INACTIVE"));
});

describe("keys — makeGsi1Sk", () => {
    it("builds the composite key in the correct segment order", () => {
        const sk = keysModule.makeGsi1Sk("HAT", 5, 500, "COMMON", "hat_iron_01");
        expect(sk).toBe("CATEGORY#HAT#LEVEL#005#PRICE#000500#RARITY#COMMON#ITEM#hat_iron_01");
    });
});

describe("keys — makeGsi2Pk", () => {
    it("wraps category in CATEGORY# prefix", () =>
        expect(keysModule.makeGsi2Pk("HAT")).toBe("CATEGORY#HAT"));
});

describe("keys — makeGsi2Sk", () => {
    it("builds LEVEL/PRICE/ITEM key", () => {
        const sk = keysModule.makeGsi2Sk(5, 500, "hat_iron_01");
        expect(sk).toBe("LEVEL#005#PRICE#000500#ITEM#hat_iron_01");
    });
});

describe("keys — buildItemKeys", () => {
    it("builds all key fields for an active item", () => {
        const keys = keysModule.buildItemKeys("hat_iron_01", "HAT", 5, 500, "COMMON", true);
        expect(keys).toEqual({
            item_pk: "SHOPITEM#hat_iron_01",
            item_sk: "META",
            gsi1pk:  "SHOP#ACTIVE",
            gsi1sk:  "CATEGORY#HAT#LEVEL#005#PRICE#000500#RARITY#COMMON#ITEM#hat_iron_01",
            gsi2pk:  "CATEGORY#HAT",
            gsi2sk:  "LEVEL#005#PRICE#000500#ITEM#hat_iron_01",
        });
    });

    it("sets gsi1pk = SHOP#INACTIVE for inactive items", () => {
        const keys = keysModule.buildItemKeys("sword_01", "WEAPON", 1, 100, "COMMON", false);
        expect(keys.gsi1pk).toBe("SHOP#INACTIVE");
    });
});

// ---------------------------------------------------------------------------
// 2. validation.ts
// ---------------------------------------------------------------------------
describe("validation — validateShopItem", () => {
    it("accepts a fully valid item", () => {
        const result = validationModule.validateShopItem({
            item_id:          "hat_iron_01",
            name:             "Iron Helm",
            description:      "A basic helmet.",
            category:         "HAT",
            rarity:           "COMMON",
            gold_cost:        500,
            required_level:   5,
            is_cosmetic_only: false,
            sprite_path:      "/items/hats/iron_helm.png",
        });
        expect(result.valid).toBe(true);
    });

    it("rejects invalid item_id (uppercase)", () => {
        const result = validationModule.validateShopItem({ item_id: "HAT_IRON" });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/item_id/);
    });

    it("rejects empty name", () => {
        const result = validationModule.validateShopItem({ name: "  " });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/name/);
    });

    it("rejects unknown rarity", () => {
        const result = validationModule.validateShopItem({ rarity: "MYTHIC" });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/rarity/);
    });

    it("accepts all valid rarities", () => {
        for (const rarity of validationModule.VALID_RARITIES) {
            const result = validationModule.validateShopItem({ rarity });
            expect(result.valid).toBe(true);
        }
    });

    it("rejects negative gold_cost", () => {
        const result = validationModule.validateShopItem({ gold_cost: -1 });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/gold_cost/);
    });

    it("rejects gold_cost > 999999", () => {
        const result = validationModule.validateShopItem({ gold_cost: 1000000 });
        expect(result.valid).toBe(false);
    });

    it("rejects negative required_level", () => {
        const result = validationModule.validateShopItem({ required_level: -1 });
        expect(result.valid).toBe(false);
    });

    it("rejects required_level > 999", () => {
        const result = validationModule.validateShopItem({ required_level: 1000 });
        expect(result.valid).toBe(false);
    });

    it("accepts required_level = 0 (no level restriction)", () => {
        const result = validationModule.validateShopItem({ required_level: 0 });
        expect(result.valid).toBe(true);
    });

    it("rejects category with lowercase", () => {
        const result = validationModule.validateShopItem({ category: "hat" });
        expect(result.valid).toBe(false);
        expect((result as any).error).toMatch(/category/);
    });

    it("accepts category with underscores", () => {
        const result = validationModule.validateShopItem({ category: "ARMOR_SET" });
        expect(result.valid).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 3. repo — getItem
// ---------------------------------------------------------------------------
describe("repo — getItem", () => {
    it("returns the item when found", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeItemRaw() });
        const item = await repoModule.getItem("hat_iron_01");
        expect(item).not.toBeNull();
        expect(item?.item_id).toBe("hat_iron_01");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Key).toEqual({
            item_pk: "SHOPITEM#hat_iron_01",
            item_sk: "META",
        });
    });

    it("returns null when item not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const item = await repoModule.getItem("nonexistent");
        expect(item).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 4. repo — listActiveItems
// ---------------------------------------------------------------------------
describe("repo — listActiveItems", () => {
    it("queries GSI1 with gsi1pk = SHOP#ACTIVE", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeItemRaw()], LastEvaluatedKey: undefined });
        const result = await repoModule.listActiveItems(10);

        expect(result.items).toHaveLength(1);
        expect(result.cursor).toBeUndefined();

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.ExpressionAttributeValues[":pk"]).toBe("SHOP#ACTIVE");
    });

    it("returns base64 cursor when LastEvaluatedKey is present", async () => {
        const lastKey = { item_pk: "SHOPITEM#x", item_sk: "META", gsi1pk: "SHOP#ACTIVE", gsi1sk: "..." };
        mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: lastKey });
        const result = await repoModule.listActiveItems(10);

        expect(result.cursor).toBeDefined();
        const decoded = JSON.parse(Buffer.from(result.cursor!, "base64").toString());
        expect(decoded).toEqual(lastKey);
    });
});

// ---------------------------------------------------------------------------
// 5. repo — listActiveByCategory
// ---------------------------------------------------------------------------
describe("repo — listActiveByCategory", () => {
    it("queries GSI1 with begins_with on CATEGORY prefix", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeItemRaw()], LastEvaluatedKey: undefined });
        const result = await repoModule.listActiveByCategory("HAT");

        expect(result.items).toHaveLength(1);
        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.IndexName).toBe("gsi1");
        expect(cmd.input.ExpressionAttributeValues[":pk"]).toBe("SHOP#ACTIVE");
        expect(cmd.input.ExpressionAttributeValues[":prefix"]).toBe("CATEGORY#HAT#");
    });
});

// ---------------------------------------------------------------------------
// 6. repo — setActiveStatus
// ---------------------------------------------------------------------------
describe("repo — setActiveStatus", () => {
    it("updates is_active and gsi1pk correctly (deactivate)", async () => {
        const deactivated = makeItemRaw({ is_active: false, gsi1pk: "SHOP#INACTIVE" });
        mockSend.mockResolvedValueOnce({ Attributes: deactivated });

        const result = await repoModule.setActiveStatus("hat_iron_01", false, "2026-01-02T00:00:00.000Z");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExpressionAttributeValues[":is_active"]).toBe(false);
        expect(cmd.input.ExpressionAttributeValues[":gsi1pk"]).toBe("SHOP#INACTIVE");
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(item_pk)");
        expect(result.is_active).toBe(false);
    });

    it("throws ConditionalCheckFailedException for missing item", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        await expect(
            repoModule.setActiveStatus("nonexistent", false, "2026-01-01T00:00:00.000Z")
        ).rejects.toMatchObject({ name: "ConditionalCheckFailedException" });
    });
});

// ---------------------------------------------------------------------------
// 7. create handler
// ---------------------------------------------------------------------------
describe("create handler", () => {
    it("returns 201 on success", async () => {
        mockSend.mockResolvedValueOnce({}); // PutCommand

        const res = await createHandler(makeEvent({}, makeCreateBody()) as any);
        expect(res.statusCode).toBe(201);
        expect(JSON.parse(res.body).item_id).toBe("hat_iron_01");
    });

    it("returns 400 when required fields are missing", async () => {
        const res = await createHandler(makeEvent({}, { item_id: "x" }) as any);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).required).toBeDefined();
    });

    it("returns 400 for invalid item_id format", async () => {
        const res = await createHandler(makeEvent({}, makeCreateBody({ item_id: "HAT IRON" })) as any);
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid rarity", async () => {
        const res = await createHandler(makeEvent({}, makeCreateBody({ rarity: "MYTHIC" })) as any);
        expect(res.statusCode).toBe(400);
    });

    it("returns 409 when item already exists", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const res = await createHandler(makeEvent({}, makeCreateBody()) as any);
        expect(res.statusCode).toBe(409);
    });
});

// ---------------------------------------------------------------------------
// 8. get handler
// ---------------------------------------------------------------------------
describe("get handler", () => {
    it("returns 200 with item on success", async () => {
        mockSend.mockResolvedValueOnce({ Item: makeItemRaw() });

        const res = await getHandler(makeEvent({ pathParameters: { item_id: "hat_iron_01" } }) as any);
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).item_id).toBe("hat_iron_01");
    });

    it("returns 400 when item_id is missing from path", async () => {
        const res = await getHandler(makeEvent({ pathParameters: {} }) as any);
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 when item does not exist", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });

        const res = await getHandler(makeEvent({ pathParameters: { item_id: "nonexistent" } }) as any);
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 9. list-active handler
// ---------------------------------------------------------------------------
describe("list-active handler", () => {
    it("returns 200 with items and count", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeItemRaw()], LastEvaluatedKey: undefined });

        const res = await listActiveHandler(makeEvent() as any);
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.count).toBe(1);
        expect(body.cursor).toBeNull();
    });

    it("returns 400 for invalid limit query param", async () => {
        const res = await listActiveHandler(
            makeEvent({ queryStringParameters: { limit: "0" } }) as any
        );
        expect(res.statusCode).toBe(400);
    });

    it("clamps limit to 500", async () => {
        mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });

        await listActiveHandler(
            makeEvent({ queryStringParameters: { limit: "9999" } }) as any
        );

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.Limit).toBe(500);
    });
});

// ---------------------------------------------------------------------------
// 10. list-by-category handler
// ---------------------------------------------------------------------------
describe("list-by-category handler", () => {
    it("returns 200 with category and items", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeItemRaw()], LastEvaluatedKey: undefined });

        const res = await listByCategoryHandler(
            makeEvent({ pathParameters: { category: "HAT" } }) as any
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.category).toBe("HAT");
        expect(body.items).toHaveLength(1);
    });

    it("returns 400 when category is missing", async () => {
        const res = await listByCategoryHandler(makeEvent({ pathParameters: {} }) as any);
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid category format (lowercase)", async () => {
        const res = await listByCategoryHandler(
            makeEvent({ pathParameters: { category: "hat" } }) as any
        );
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// 11. update handler
// ---------------------------------------------------------------------------
describe("update handler", () => {
    it("returns 200 with updated item when no GSI key fields change", async () => {
        const updated = makeItemRaw({ name: "Shiny Iron Helm" });
        mockSend.mockResolvedValueOnce({ Attributes: updated }); // updateItem

        const res = await updateHandler(
            makeEvent(
                { pathParameters: { item_id: "hat_iron_01" } },
                { name: "Shiny Iron Helm" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).name).toBe("Shiny Iron Helm");
    });

    it("fetches current item and recomputes GSI keys when category changes", async () => {
        const current = makeItemRaw();
        const updated = makeItemRaw({
            category: "HELM",
            gsi1pk:   "SHOP#ACTIVE",
            gsi1sk:   "CATEGORY#HELM#LEVEL#005#PRICE#000500#RARITY#COMMON#ITEM#hat_iron_01",
            gsi2pk:   "CATEGORY#HELM",
            gsi2sk:   "LEVEL#005#PRICE#000500#ITEM#hat_iron_01",
        });
        mockSend
            .mockResolvedValueOnce({ Item: current })     // getItem (to read current values)
            .mockResolvedValueOnce({ Attributes: updated }); // updateItem

        const res = await updateHandler(
            makeEvent(
                { pathParameters: { item_id: "hat_iron_01" } },
                { category: "HELM" }
            ) as any
        );
        expect(res.statusCode).toBe(200);
        // Both GetCommand + UpdateCommand must have been called
        expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("returns 400 when no fields provided", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { item_id: "hat_iron_01" } }, {}) as any
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when item_id is missing from path", async () => {
        const res = await updateHandler(makeEvent({ pathParameters: {} }, { name: "X" }) as any);
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 when item does not exist (ConditionalCheckFailed)", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const res = await updateHandler(
            makeEvent({ pathParameters: { item_id: "ghost" } }, { name: "X" }) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 12. deactivate handler
// ---------------------------------------------------------------------------
describe("deactivate handler", () => {
    it("returns 200 with ok=true and updated item", async () => {
        const deactivated = makeItemRaw({ is_active: false, gsi1pk: "SHOP#INACTIVE" });
        mockSend.mockResolvedValueOnce({ Attributes: deactivated });

        const res = await deactivateHandler(
            makeEvent({ pathParameters: { item_id: "hat_iron_01" } }) as any
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.ok).toBe(true);
        expect(body.item.is_active).toBe(false);
    });

    it("returns 400 when item_id is missing", async () => {
        const res = await deactivateHandler(makeEvent({ pathParameters: {} }) as any);
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 for non-existent item", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const res = await deactivateHandler(
            makeEvent({ pathParameters: { item_id: "ghost" } }) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 13. activate handler
// ---------------------------------------------------------------------------
describe("activate handler", () => {
    it("returns 200 with ok=true and is_active=true", async () => {
        const activated = makeItemRaw({ is_active: true, gsi1pk: "SHOP#ACTIVE" });
        mockSend.mockResolvedValueOnce({ Attributes: activated });

        const res = await activateHandler(
            makeEvent({ pathParameters: { item_id: "hat_iron_01" } }) as any
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.ok).toBe(true);
        expect(body.item.is_active).toBe(true);
    });

    it("returns 400 when item_id is missing", async () => {
        const res = await activateHandler(makeEvent({ pathParameters: {} }) as any);
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 for non-existent item", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const res = await activateHandler(
            makeEvent({ pathParameters: { item_id: "ghost" } }) as any
        );
        expect(res.statusCode).toBe(404);
    });
});

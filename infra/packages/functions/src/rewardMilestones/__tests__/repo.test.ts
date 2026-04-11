import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  DynamoDB mock boilerplate                                         */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Module under test                                                  */
/* ------------------------------------------------------------------ */
let repo: typeof import("../repo.ts");

beforeAll(async () => {
    process.env.REWARD_MILESTONES_TABLE_NAME = "test-rewards";
    repo = await import("../repo.ts");
});

beforeEach(() => {
    mockSend.mockReset();
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function makeReward(overrides: Record<string, any> = {}) {
    return {
        reward_id: "r-1",
        class_id: "class-1",
        created_by_teacher_id: "teacher-1",
        title: "Copper Helmet",
        description: "A sturdy helmet.",
        unlock_level: 5,
        type: "HELMET",
        reward_target_type: "ITEM",
        reward_target_id: "item-1",
        image_asset_key: "helmets/copper.png",
        is_active: true,
        is_deleted: false,
        unlock_sort: "ACTIVE#00005#HELMET#r-1",
        teacher_sort: "class-1#ACTIVE#00005#r-1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

/* ================================================================== */
/*  createRewardMilestone                                              */
/* ================================================================== */
describe("createRewardMilestone", () => {
    it("sends PutCommand with correct table and condition", async () => {
        mockSend.mockResolvedValue({});
        const item = makeReward();

        await repo.createRewardMilestone(item as any);

        expect(mockSend).toHaveBeenCalledOnce();
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-rewards");
        expect(cmd.input.Item).toEqual(item);
        expect(cmd.input.ConditionExpression).toBe("attribute_not_exists(reward_id)");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(repo.createRewardMilestone(makeReward() as any)).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.createRewardMilestone(makeReward() as any)).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  getRewardMilestoneById                                             */
/* ================================================================== */
describe("getRewardMilestoneById", () => {
    it("returns item when found", async () => {
        const item = makeReward();
        mockSend.mockResolvedValue({ Item: item });

        const result = await repo.getRewardMilestoneById("r-1");

        expect(result).toEqual(item);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-rewards");
        expect(cmd.input.Key).toEqual({ reward_id: "r-1" });
    });

    it("returns null when item not found", async () => {
        mockSend.mockResolvedValue({});
        const result = await repo.getRewardMilestoneById("missing");
        expect(result).toBeNull();
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.getRewardMilestoneById("r-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listRewardMilestonesByClass                                        */
/* ================================================================== */
describe("listRewardMilestonesByClass", () => {
    it("queries GSI1 with correct class_id", async () => {
        const items = [makeReward()];
        mockSend.mockResolvedValue({ Items: items });

        const result = await repo.listRewardMilestonesByClass("class-1");

        expect(result).toEqual(items);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-rewards");
        expect(cmd.input.IndexName).toBe("GSI1");
        expect(cmd.input.ExpressionAttributeValues[":cid"]).toBe("class-1");
    });

    it("filters out soft-deleted items by default", async () => {
        const active = makeReward({ reward_id: "r-1" });
        const deleted = makeReward({ reward_id: "r-2", is_deleted: true });
        mockSend.mockResolvedValue({ Items: [active, deleted] });

        const result = await repo.listRewardMilestonesByClass("class-1");
        expect(result).toHaveLength(1);
        expect(result[0].reward_id).toBe("r-1");
    });

    it("includes deleted items when includeDeleted is true", async () => {
        const active = makeReward({ reward_id: "r-1" });
        const deleted = makeReward({ reward_id: "r-2", is_deleted: true });
        mockSend.mockResolvedValue({ Items: [active, deleted] });

        const result = await repo.listRewardMilestonesByClass("class-1", { includeDeleted: true });
        expect(result).toHaveLength(2);
    });

    it("returns empty array when no items", async () => {
        mockSend.mockResolvedValue({ Items: [] });
        const result = await repo.listRewardMilestonesByClass("class-1");
        expect(result).toEqual([]);
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValue({});
        const result = await repo.listRewardMilestonesByClass("class-1");
        expect(result).toEqual([]);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.listRewardMilestonesByClass("class-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  listRewardMilestonesByTeacher                                      */
/* ================================================================== */
describe("listRewardMilestonesByTeacher", () => {
    it("queries GSI2 with correct teacher_id", async () => {
        const items = [makeReward()];
        mockSend.mockResolvedValue({ Items: items });

        const result = await repo.listRewardMilestonesByTeacher("teacher-1");

        expect(result).toEqual(items);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("GSI2");
        expect(cmd.input.ExpressionAttributeValues[":tid"]).toBe("teacher-1");
    });

    it("filters out soft-deleted items by default", async () => {
        const active = makeReward({ reward_id: "r-1" });
        const deleted = makeReward({ reward_id: "r-2", is_deleted: true });
        mockSend.mockResolvedValue({ Items: [active, deleted] });

        const result = await repo.listRewardMilestonesByTeacher("teacher-1");
        expect(result).toHaveLength(1);
    });

    it("includes deleted items when includeDeleted is true", async () => {
        mockSend.mockResolvedValue({ Items: [makeReward(), makeReward({ is_deleted: true })] });
        const result = await repo.listRewardMilestonesByTeacher("teacher-1", { includeDeleted: true });
        expect(result).toHaveLength(2);
    });

    it("returns empty array when no items", async () => {
        mockSend.mockResolvedValue({});
        const result = await repo.listRewardMilestonesByTeacher("teacher-1");
        expect(result).toEqual([]);
    });

    it("propagates DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.listRewardMilestonesByTeacher("teacher-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  updateRewardMilestone                                              */
/* ================================================================== */
describe("updateRewardMilestone", () => {
    const baseUpdates = {
        current_class_id: "class-1",
        current_is_active: true,
        current_unlock_level: 5,
        current_type: "HELMET",
    };

    it("sends UpdateCommand with correct table, key, and condition", async () => {
        mockSend.mockResolvedValue({});

        await repo.updateRewardMilestone("r-1", { ...baseUpdates, title: "New Title" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-rewards");
        expect(cmd.input.Key).toEqual({ reward_id: "r-1" });
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(reward_id)");
    });

    it("always sets updated_at", async () => {
        mockSend.mockResolvedValue({});
        await repo.updateRewardMilestone("r-1", { ...baseUpdates, title: "X" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("#updated_at = :updated_at");
        expect(cmd.input.ExpressionAttributeValues[":updated_at"]).toBeDefined();
    });

    it("includes title in update expression", async () => {
        mockSend.mockResolvedValue({});
        await repo.updateRewardMilestone("r-1", { ...baseUpdates, title: "New" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":title"]).toBe("New");
    });

    it("includes description in update expression", async () => {
        mockSend.mockResolvedValue({});
        await repo.updateRewardMilestone("r-1", { ...baseUpdates, description: "Desc" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":description"]).toBe("Desc");
    });

    it("recomputes sort keys when unlock_level changes", async () => {
        mockSend.mockResolvedValue({});
        await repo.updateRewardMilestone("r-1", { ...baseUpdates, unlock_level: 10 });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":unlock_sort"]).toContain("00010");
        expect(cmd.input.ExpressionAttributeValues[":teacher_sort"]).toContain("00010");
    });

    it("recomputes sort keys when type changes", async () => {
        mockSend.mockResolvedValue({});
        await repo.updateRewardMilestone("r-1", { ...baseUpdates, type: "PET" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":unlock_sort"]).toContain("PET");
    });

    it("does not recompute sort keys when only title changes", async () => {
        mockSend.mockResolvedValue({});
        await repo.updateRewardMilestone("r-1", { ...baseUpdates, title: "X" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":unlock_sort"]).toBeUndefined();
    });

    it("uses REMOVE clause when image_asset_key is null", async () => {
        mockSend.mockResolvedValue({});
        await repo.updateRewardMilestone("r-1", { ...baseUpdates, image_asset_key: null } as any);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("REMOVE #image_asset_key");
    });

    it("sets image_asset_key when non-null value provided", async () => {
        mockSend.mockResolvedValue({});
        await repo.updateRewardMilestone("r-1", { ...baseUpdates, image_asset_key: "new.png" });

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":image_asset_key"]).toBe("new.png");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);

        await expect(repo.updateRewardMilestone("r-1", { ...baseUpdates, title: "X" })).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.updateRewardMilestone("r-1", { ...baseUpdates, title: "X" })).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  setRewardMilestoneStatus                                           */
/* ================================================================== */
describe("setRewardMilestoneStatus", () => {
    const current = { class_id: "class-1", unlock_level: 5, type: "HELMET" };

    it("sends UpdateCommand with recomputed sort keys", async () => {
        mockSend.mockResolvedValue({});

        await repo.setRewardMilestoneStatus("r-1", false, current);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":is_active"]).toBe(false);
        expect(cmd.input.ExpressionAttributeValues[":unlock_sort"]).toContain("INACTIVE");
        expect(cmd.input.ExpressionAttributeValues[":teacher_sort"]).toContain("INACTIVE");
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(reward_id)");
    });

    it("uses ACTIVE prefix when activating", async () => {
        mockSend.mockResolvedValue({});
        await repo.setRewardMilestoneStatus("r-1", true, current);

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":unlock_sort"]).toContain("ACTIVE");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);
        await expect(repo.setRewardMilestoneStatus("r-1", true, current)).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.setRewardMilestoneStatus("r-1", true, current)).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  softDeleteRewardMilestone                                          */
/* ================================================================== */
describe("softDeleteRewardMilestone", () => {
    it("sets is_deleted=true and records deleted_at", async () => {
        mockSend.mockResolvedValue({});

        await repo.softDeleteRewardMilestone("r-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":true"]).toBe(true);
        expect(cmd.input.ExpressionAttributeValues[":now"]).toBeDefined();
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(reward_id)");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);
        await expect(repo.softDeleteRewardMilestone("r-1")).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.softDeleteRewardMilestone("r-1")).rejects.toThrow("DDB boom");
    });
});

/* ================================================================== */
/*  restoreRewardMilestone                                             */
/* ================================================================== */
describe("restoreRewardMilestone", () => {
    it("sets is_deleted=false and REMOVEs deleted_at", async () => {
        mockSend.mockResolvedValue({});

        await repo.restoreRewardMilestone("r-1");

        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":false"]).toBe(false);
        expect(cmd.input.UpdateExpression).toContain("REMOVE #deleted_at");
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(reward_id)");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValue(err);
        await expect(repo.restoreRewardMilestone("r-1")).rejects.toThrow();
    });

    it("propagates generic DynamoDB errors", async () => {
        mockSend.mockRejectedValue(new Error("DDB boom"));
        await expect(repo.restoreRewardMilestone("r-1")).rejects.toThrow("DDB boom");
    });
});

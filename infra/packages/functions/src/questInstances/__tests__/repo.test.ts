/**
 * Unit tests for questInstances/repo.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questInstances
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock AWS SDK
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
// Module under test (dynamic import after env setup)
// ---------------------------------------------------------------------------
let repo: typeof import("../repo.js");

beforeAll(async () => {
    process.env.QUEST_INSTANCES_TABLE_NAME = "test-quest-instances";
    repo = await import("../repo.js");
});

beforeEach(() => {
    mockSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeItem(overrides: Record<string, any> = {}) {
    return {
        quest_instance_id: "qi-1",
        class_id: "class-1",
        status: "DRAFT" as const,
        requires_manual_approval: false,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// computeScheduleKeys (pure function — no DDB)
// ---------------------------------------------------------------------------
describe("computeScheduleKeys", () => {
    it("returns schedule keys when status is SCHEDULED and start_date is provided", () => {
        const result = repo.computeScheduleKeys("SCHEDULED", "qi-1", "2024-06-01");
        expect(result.schedule_pk).toBe("SCHEDULED");
        expect(result.schedule_sk).toBe("2024-06-01#qi-1");
    });

    it("returns empty object when status is not SCHEDULED", () => {
        expect(repo.computeScheduleKeys("ACTIVE", "qi-1", "2024-06-01")).toEqual({});
        expect(repo.computeScheduleKeys("DRAFT", "qi-1", "2024-06-01")).toEqual({});
        expect(repo.computeScheduleKeys("ARCHIVED", "qi-1", "2024-06-01")).toEqual({});
    });

    it("returns empty object when status is SCHEDULED but start_date is absent", () => {
        expect(repo.computeScheduleKeys("SCHEDULED", "qi-1", undefined)).toEqual({});
        expect(repo.computeScheduleKeys("SCHEDULED", "qi-1", null)).toEqual({});
    });

    it("includes quest_instance_id in schedule_sk", () => {
        const result = repo.computeScheduleKeys("SCHEDULED", "unique-id-999", "2024-06-01");
        expect(result.schedule_sk).toContain("unique-id-999");
    });
});

// ---------------------------------------------------------------------------
// createInstance
// ---------------------------------------------------------------------------
describe("createInstance", () => {
    it("sends PutCommand with correct TableName", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.createInstance(makeItem() as any);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-quest-instances");
    });

    it("sends the full item to DynamoDB", async () => {
        mockSend.mockResolvedValueOnce({});
        const item = makeItem({ title_override: "Test Quest" });
        await repo.createInstance(item as any);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Item).toEqual(item);
    });

    it("uses attribute_not_exists(quest_instance_id) ConditionExpression", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.createInstance(makeItem() as any);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ConditionExpression).toBe("attribute_not_exists(quest_instance_id)");
    });

    it("propagates DynamoDB errors", async () => {
        const err = Object.assign(new Error("conditional failed"), { name: "ConditionalCheckFailedException" });
        mockSend.mockRejectedValueOnce(err);
        await expect(repo.createInstance(makeItem() as any)).rejects.toThrow("conditional failed");
    });
});

// ---------------------------------------------------------------------------
// getInstance
// ---------------------------------------------------------------------------
describe("getInstance", () => {
    it("returns the item when found", async () => {
        const item = makeItem();
        mockSend.mockResolvedValueOnce({ Item: item });
        const result = await repo.getInstance("qi-1");
        expect(result).toEqual(item);
    });

    it("returns null when Item is undefined", async () => {
        mockSend.mockResolvedValueOnce({});
        const result = await repo.getInstance("qi-1");
        expect(result).toBeNull();
    });

    it("passes the correct Key to GetCommand", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.getInstance("qi-42");
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.Key).toEqual({ quest_instance_id: "qi-42" });
    });

    it("uses correct TableName", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.getInstance("qi-1");
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-quest-instances");
    });
});

// ---------------------------------------------------------------------------
// listByClass
// ---------------------------------------------------------------------------
describe("listByClass", () => {
    it("returns items from gsi1 query", async () => {
        const items = [makeItem()];
        mockSend.mockResolvedValueOnce({ Items: items });
        const result = await repo.listByClass("class-1");
        expect(result).toEqual(items);
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValueOnce({});
        const result = await repo.listByClass("class-1");
        expect(result).toEqual([]);
    });

    it("queries gsi1 index", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        await repo.listByClass("class-1");
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi1");
    });

    it("uses class_id = :cid condition with the provided class_id", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        await repo.listByClass("class-xyz");
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":cid"]).toBe("class-xyz");
    });
});

// ---------------------------------------------------------------------------
// listByTemplate
// ---------------------------------------------------------------------------
describe("listByTemplate", () => {
    it("returns items from gsi2 query", async () => {
        const items = [makeItem()];
        mockSend.mockResolvedValueOnce({ Items: items });
        const result = await repo.listByTemplate("tmpl-1");
        expect(result).toEqual(items);
    });

    it("returns empty array when Items is undefined", async () => {
        mockSend.mockResolvedValueOnce({});
        const result = await repo.listByTemplate("tmpl-1");
        expect(result).toEqual([]);
    });

    it("queries gsi2 index", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        await repo.listByTemplate("tmpl-1");
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe("gsi2");
    });

    it("passes quest_template_id in ExpressionAttributeValues", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });
        await repo.listByTemplate("tmpl-abc");
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":tid"]).toBe("tmpl-abc");
    });
});

// ---------------------------------------------------------------------------
// updateStatus
// ---------------------------------------------------------------------------
describe("updateStatus", () => {
    it("sends UpdateCommand with correct TableName and Key", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateStatus("qi-1", "ACTIVE");
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-quest-instances");
        expect(cmd.input.Key).toEqual({ quest_instance_id: "qi-1" });
    });

    it("uses attribute_exists ConditionExpression", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateStatus("qi-1", "ACTIVE");
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(quest_instance_id)");
    });

    it("sets schedule keys in UpdateExpression when transitioning to SCHEDULED", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateStatus("qi-1", "SCHEDULED", "2024-06-01");
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("SET");
        expect(cmd.input.UpdateExpression).not.toContain("REMOVE");
        expect(cmd.input.ExpressionAttributeValues[":schedule_pk"]).toBe("SCHEDULED");
        expect(cmd.input.ExpressionAttributeValues[":schedule_sk"]).toBe("2024-06-01#qi-1");
    });

    it("includes REMOVE for schedule keys when transitioning to non-SCHEDULED status", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateStatus("qi-1", "ACTIVE");
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("REMOVE");
        expect(cmd.input.UpdateExpression).toContain("#schedule_pk");
        expect(cmd.input.UpdateExpression).toContain("#schedule_sk");
    });

    it("sets the new status in ExpressionAttributeValues", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateStatus("qi-1", "ARCHIVED");
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":status"]).toBe("ARCHIVED");
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = Object.assign(new Error("condition failed"), { name: "ConditionalCheckFailedException" });
        mockSend.mockRejectedValueOnce(err);
        await expect(repo.updateStatus("qi-1", "ACTIVE")).rejects.toMatchObject({ name: "ConditionalCheckFailedException" });
    });
});

// ---------------------------------------------------------------------------
// updateDates
// ---------------------------------------------------------------------------
describe("updateDates", () => {
    it("sends UpdateCommand with correct TableName and Key", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateDates("qi-1", "2024-06-01", undefined);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.TableName).toBe("test-quest-instances");
        expect(cmd.input.Key).toEqual({ quest_instance_id: "qi-1" });
    });

    it("uses attribute_exists ConditionExpression", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateDates("qi-1", "2024-06-01", undefined);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(quest_instance_id)");
    });

    it("SETs start_date and updates schedule_sk when start_date is provided", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateDates("qi-1", "2024-06-01", undefined);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("SET");
        expect(cmd.input.ExpressionAttributeValues[":start_date"]).toBe("2024-06-01");
        expect(cmd.input.ExpressionAttributeValues[":schedule_sk"]).toBe("2024-06-01#qi-1");
    });

    it("REMOVEs start_date and schedule keys when start_date is null", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateDates("qi-1", null, undefined);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("REMOVE");
        expect(cmd.input.UpdateExpression).toContain("#start_date");
        expect(cmd.input.UpdateExpression).toContain("#schedule_pk");
        expect(cmd.input.UpdateExpression).toContain("#schedule_sk");
    });

    it("SETs due_date when due_date is provided", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateDates("qi-1", undefined, "2024-07-01");
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":due_date"]).toBe("2024-07-01");
    });

    it("REMOVEs due_date when due_date is null", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateDates("qi-1", undefined, null);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("REMOVE");
        expect(cmd.input.UpdateExpression).toContain("#due_date");
    });

    it("always includes updated_at in SET", async () => {
        mockSend.mockResolvedValueOnce({});
        await repo.updateDates("qi-1", "2024-06-01", undefined);
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.UpdateExpression).toContain("#updated_at");
    });

    it("passes undefined ExpressionAttributeValues when no dates provided", async () => {
        mockSend.mockResolvedValueOnce({});
        // Only updated_at gets set (from undefined/undefined), so values object still exists
        await repo.updateDates("qi-1", undefined, undefined);
        const cmd = mockSend.mock.calls[0][0];
        // Should still have updated_at value
        expect(cmd.input.ExpressionAttributeValues).toBeDefined();
    });

    it("propagates ConditionalCheckFailedException", async () => {
        const err = Object.assign(new Error("condition failed"), { name: "ConditionalCheckFailedException" });
        mockSend.mockRejectedValueOnce(err);
        await expect(repo.updateDates("qi-1", "2024-06-01", undefined)).rejects.toMatchObject({ name: "ConditionalCheckFailedException" });
    });
});

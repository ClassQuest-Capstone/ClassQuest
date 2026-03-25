/**
 * Unit tests for the Classes update feature.
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
    ConditionalCheckFailedException: class ConditionalCheckFailedException extends Error {
        constructor() { super("failed"); this.name = "ConditionalCheckFailedException"; }
    },
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
// Module references — populated in beforeAll
// ---------------------------------------------------------------------------
let repoModule:    typeof import("../repo.ts");
let updateHandler: (typeof import("../update.ts"))["handler"];

beforeAll(async () => {
    process.env.CLASSES_TABLE_NAME = "test-classes";

    repoModule     = await import("../repo.ts");
    updateHandler  = (await import("../update.ts")).handler;
});

beforeEach(() => { mockSend.mockReset(); });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeClass(overrides: Record<string, any> = {}) {
    return {
        class_id:                "class-001",
        school_id:               "school-abc",
        name:                    "Math 101",
        subject:                 "Mathematics",
        grade_level:             8,
        created_by_teacher_id:   "teacher-xyz",
        join_code:               "ABC123",
        is_active:               true,
        created_at:              "2026-01-01T00:00:00.000Z",
        updated_at:              "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function makeEvent(overrides: Record<string, any> = {}, body?: Record<string, any>) {
    return {
        pathParameters:        {},
        queryStringParameters: {},
        headers:               { "x-teacher-id": "teacher-xyz" },
        body: body ? JSON.stringify(body) : undefined,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// 1. repo — updateClass builds correct UpdateExpression
// ---------------------------------------------------------------------------
describe("repo — updateClass", () => {
    it("sets updated_at and provided name field", async () => {
        const updated = makeClass({ name: "Math 8A", updated_at: "2026-03-25T00:00:00.000Z" });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        const result = await repoModule.updateClass("class-001", { name: "Math 8A" }, true);

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.UpdateExpression).toContain("updated_at");
        expect(cmd.input.ExpressionAttributeValues[":name"]).toBe("Math 8A");
        expect(result.name).toBe("Math 8A");
    });

    it("sets deactivated_at when is_active flips true→false", async () => {
        const updated = makeClass({ is_active: false, deactivated_at: "2026-03-25T00:00:00.000Z" });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        await repoModule.updateClass("class-001", { is_active: false }, true);

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.UpdateExpression).toContain("deactivated_at");
        expect(cmd.input.ExpressionAttributeValues[":is_active"]).toBe(false);
    });

    it("removes deactivated_at when is_active flips false→true", async () => {
        const updated = makeClass({ is_active: true });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        await repoModule.updateClass("class-001", { is_active: true }, false);

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.UpdateExpression).toContain("REMOVE deactivated_at");
        expect(cmd.input.ExpressionAttributeValues[":is_active"]).toBe(true);
    });

    it("does not set or remove deactivated_at when is_active is unchanged (true→true)", async () => {
        mockSend.mockResolvedValueOnce({ Attributes: makeClass() });
        await repoModule.updateClass("class-001", { is_active: true }, true);

        const [cmd] = mockSend.mock.calls[0];
        // No REMOVE clause
        expect(cmd.input.UpdateExpression).not.toContain("REMOVE");
        // deactivated_at not added in SET
        expect(cmd.input.UpdateExpression).not.toContain("deactivated_at");
    });

    it("uses conditional expression to guard against missing class", async () => {
        mockSend.mockResolvedValueOnce({ Attributes: makeClass() });
        await repoModule.updateClass("class-001", { name: "X" }, true);

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ConditionExpression).toBe("attribute_exists(class_id)");
        expect(cmd.input.ReturnValues).toBe("ALL_NEW");
    });

    it("updates multiple fields in one call", async () => {
        mockSend.mockResolvedValueOnce({ Attributes: makeClass({ name: "Science 8B", grade_level: 7 }) });

        await repoModule.updateClass("class-001", { name: "Science 8B", grade_level: 7, subject: "Science" }, true);

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExpressionAttributeValues[":name"]).toBe("Science 8B");
        expect(cmd.input.ExpressionAttributeValues[":grade_level"]).toBe(7);
        expect(cmd.input.ExpressionAttributeValues[":subject"]).toBe("Science");
    });
});

// ---------------------------------------------------------------------------
// 2. update handler — validation
// ---------------------------------------------------------------------------
describe("update handler — validation", () => {
    it("returns 400 when class_id missing from path", async () => {
        const res = await updateHandler(makeEvent({ pathParameters: {} }, { name: "X" }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_CLASS_ID");
    });

    it("returns 400 when no editable fields provided", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, {})
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("NO_EDITABLE_FIELDS");
    });

    it("returns 400 for unknown fields", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { join_code: "HACK00" })
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("UNKNOWN_FIELDS");
    });

    it("returns 400 for empty name string", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { name: "   " })
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_NAME");
    });

    it("returns 400 for invalid grade_level (out of range)", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { grade_level: 99 })
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_GRADE_LEVEL");
    });

    it("returns 400 for non-integer grade_level", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { grade_level: 8.5 })
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_GRADE_LEVEL");
    });

    it("returns 400 for non-boolean is_active", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { is_active: "yes" })
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_IS_ACTIVE");
    });

    it("returns 400 for invalid JSON body", async () => {
        const res = await updateHandler({
            pathParameters: { class_id: "class-001" },
            headers: { "x-teacher-id": "teacher-xyz" },
            body: "not json",
        });
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_JSON");
    });
});

// ---------------------------------------------------------------------------
// 3. update handler — authorization
// ---------------------------------------------------------------------------
describe("update handler — authorization", () => {
    it("returns 403 when a different teacher tries to edit", async () => {
        // GetCommand returns a class owned by teacher-xyz
        mockSend.mockResolvedValueOnce({ Item: makeClass() });

        const res = await updateHandler(
            makeEvent(
                { pathParameters: { class_id: "class-001" }, headers: { "x-teacher-id": "teacher-other" } },
                { name: "Hack Class" }
            )
        );
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body).error).toBe("FORBIDDEN");
    });
});

// ---------------------------------------------------------------------------
// 4. update handler — successful updates
// ---------------------------------------------------------------------------
describe("update handler — successful updates", () => {
    it("returns 200 and updated class when name is changed", async () => {
        const existing = makeClass();
        const updated  = makeClass({ name: "Math 8A", updated_at: "2026-03-25T00:00:00.000Z" });

        mockSend.mockResolvedValueOnce({ Item: existing });    // getClass
        mockSend.mockResolvedValueOnce({ Attributes: updated }); // updateClass

        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { name: "Math 8A" })
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.name).toBe("Math 8A");
        expect(body.updated_at).toBeDefined();
    });

    it("returns 200 when subject is updated", async () => {
        const existing = makeClass();
        const updated  = makeClass({ subject: "Physics", updated_at: "2026-03-25T00:00:00.000Z" });

        mockSend.mockResolvedValueOnce({ Item: existing });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { subject: "Physics" })
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).subject).toBe("Physics");
    });

    it("returns 200 when grade_level is updated", async () => {
        const existing = makeClass();
        const updated  = makeClass({ grade_level: 7, updated_at: "2026-03-25T00:00:00.000Z" });

        mockSend.mockResolvedValueOnce({ Item: existing });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { grade_level: 7 })
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).grade_level).toBe(7);
    });

    it("returns 200 and sets deactivated_at when is_active changes true→false", async () => {
        const existing = makeClass({ is_active: true });
        const updated  = makeClass({ is_active: false, deactivated_at: "2026-03-25T00:00:00.000Z", updated_at: "2026-03-25T00:00:00.000Z" });

        mockSend.mockResolvedValueOnce({ Item: existing });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { is_active: false })
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.is_active).toBe(false);
        expect(body.deactivated_at).toBeDefined();
    });

    it("returns 200 and clears deactivated_at when is_active changes false→true", async () => {
        const existing = makeClass({ is_active: false, deactivated_at: "2026-02-01T00:00:00.000Z" });
        const updated  = makeClass({ is_active: true, updated_at: "2026-03-25T00:00:00.000Z" });

        mockSend.mockResolvedValueOnce({ Item: existing });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { is_active: true })
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).is_active).toBe(true);
    });

    it("trims whitespace from name and subject", async () => {
        const existing = makeClass();
        const updated  = makeClass({ name: "Trimmed Name", updated_at: "2026-03-25T00:00:00.000Z" });

        mockSend.mockResolvedValueOnce({ Item: existing });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { name: "  Trimmed Name  " })
        );

        // The UpdateCommand should have received the trimmed value
        const calls = mockSend.mock.calls;
        // Second call is the UpdateCommand
        const updateCmd = calls[1][0];
        expect(updateCmd.input.ExpressionAttributeValues[":name"]).toBe("Trimmed Name");
    });

    it("partial update preserves untouched fields", async () => {
        const existing = makeClass({ subject: "OriginalSubject" });
        const updated  = makeClass({ name: "New Name", subject: "OriginalSubject", updated_at: "2026-03-25T00:00:00.000Z" });

        mockSend.mockResolvedValueOnce({ Item: existing });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { name: "New Name" })
        );
        expect(res.statusCode).toBe(200);
        // subject not overwritten
        expect(JSON.parse(res.body).subject).toBe("OriginalSubject");
        // Only one update call, not a full replace
        expect(mockSend).toHaveBeenCalledTimes(2); // get + update
    });

    it("updated_at changes on every successful edit", async () => {
        const existing = makeClass({ updated_at: "2026-01-01T00:00:00.000Z" });
        const updated  = makeClass({ updated_at: "2026-03-25T12:00:00.000Z" });

        mockSend.mockResolvedValueOnce({ Item: existing });
        mockSend.mockResolvedValueOnce({ Attributes: updated });

        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { name: "Updated" })
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).updated_at).toBe("2026-03-25T12:00:00.000Z");
    });
});

// ---------------------------------------------------------------------------
// 5. update handler — not found
// ---------------------------------------------------------------------------
describe("update handler — not found", () => {
    it("returns 404 when class does not exist (getClass returns null)", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined }); // getClass → null

        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "nonexistent" } }, { name: "X" })
        );
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toBe("CLASS_NOT_FOUND");
    });

    it("returns 404 on ConditionalCheckFailedException from updateClass", async () => {
        const existing = makeClass();
        mockSend.mockResolvedValueOnce({ Item: existing }); // getClass succeeds
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err); // updateClass race condition

        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { name: "X" })
        );
        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 6. update handler — protected fields cannot be submitted
// ---------------------------------------------------------------------------
describe("update handler — protected fields rejected", () => {
    it("rejects class_id in body", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { class_id: "new-id" })
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("UNKNOWN_FIELDS");
    });

    it("rejects created_by_teacher_id in body", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { created_by_teacher_id: "hacker" })
        );
        expect(res.statusCode).toBe(400);
    });

    it("rejects school_id in body", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { school_id: "other-school" })
        );
        expect(res.statusCode).toBe(400);
    });

    it("rejects join_code in body", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { join_code: "HACK00" })
        );
        expect(res.statusCode).toBe(400);
    });

    it("rejects created_at in body", async () => {
        const res = await updateHandler(
            makeEvent({ pathParameters: { class_id: "class-001" } }, { created_at: "1970-01-01T00:00:00.000Z" })
        );
        expect(res.statusCode).toBe(400);
    });
});

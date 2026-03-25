/**
 * Unit tests for the ClassEnrollments feature.
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
let enrollHandler: (typeof import("../enroll.ts"))["handler"];
let unenrollHandler: (typeof import("../unenroll.ts"))["handler"];
let restoreHandler: (typeof import("../restore.ts"))["handler"];
let listByClassHandler: (typeof import("../list-by-class.ts"))["handler"];

beforeAll(async () => {
    process.env.CLASS_ENROLLMENTS_TABLE_NAME = "test-class-enrollments";

    repoModule       = await import("../repo.ts");
    enrollHandler    = (await import("../enroll.ts")).handler;
    unenrollHandler  = (await import("../unenroll.ts")).handler;
    restoreHandler   = (await import("../restore.ts")).handler;
    listByClassHandler = (await import("../list-by-class.ts")).handler;
});

beforeEach(() => { mockSend.mockReset(); });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEnrollment(overrides: Record<string, any> = {}) {
    return {
        enrollment_id: "enroll-001",
        class_id:      "class-abc",
        student_id:    "student-xyz",
        joined_at:     "2026-01-01T00:00:00.000Z",
        status:        "active",
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
// 1. repo — dropEnrollment sets status=dropped and updated_at
// ---------------------------------------------------------------------------
describe("repo — dropEnrollment", () => {
    it("sends UPDATE with status=dropped and updated_at", async () => {
        mockSend.mockResolvedValueOnce({});
        await repoModule.dropEnrollment("enroll-001");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.UpdateExpression).toContain("dropped_at");
        expect(cmd.input.UpdateExpression).toContain("updated_at");
        expect(cmd.input.ExpressionAttributeValues[":dropped"]).toBe("dropped");
    });

    it("throws ConditionalCheckFailedException when enrollment not found", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        await expect(repoModule.dropEnrollment("nonexistent")).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// 2. repo — restoreEnrollment sets status=active and clears dropped_at
// ---------------------------------------------------------------------------
describe("repo — restoreEnrollment", () => {
    it("sends UPDATE with status=active, restored_at, updated_at, REMOVE dropped_at", async () => {
        mockSend.mockResolvedValueOnce({ Attributes: makeEnrollment({ status: "active", restored_at: "2026-03-01T00:00:00.000Z" }) });
        const result = await repoModule.restoreEnrollment("enroll-001");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.UpdateExpression).toContain(":active");
        expect(cmd.input.UpdateExpression).toContain("restored_at");
        expect(cmd.input.UpdateExpression).toContain("REMOVE dropped_at");
        expect(cmd.input.ExpressionAttributeValues[":active"]).toBe("active");
        expect(result.status).toBe("active");
    });
});

// ---------------------------------------------------------------------------
// 3. unenroll handler — soft delete, not hard delete
// ---------------------------------------------------------------------------
describe("unenroll handler — soft delete", () => {
    it("returns 200 and does not hard-delete the record", async () => {
        mockSend.mockResolvedValueOnce({});
        const res = await unenrollHandler(
            makeEvent({ pathParameters: { enrollment_id: "enroll-001" } })
        );
        expect(res.statusCode).toBe(200);

        // Verify it called UpdateCommand (soft delete), not DeleteCommand
        const [cmd] = mockSend.mock.calls[0];
        // UpdateCommand input has UpdateExpression; DeleteCommand does not
        expect(cmd.input.UpdateExpression).toBeDefined();
        expect(cmd.input.UpdateExpression).toContain("dropped");
    });

    it("returns 404 when enrollment not found", async () => {
        const err = new Error("failed");
        err.name = "ConditionalCheckFailedException";
        mockSend.mockRejectedValueOnce(err);

        const res = await unenrollHandler(
            makeEvent({ pathParameters: { enrollment_id: "nonexistent" } })
        );
        expect(res.statusCode).toBe(404);
    });

    it("returns 400 when enrollment_id missing from path", async () => {
        const res = await unenrollHandler(makeEvent({ pathParameters: {} }));
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// 4. list-by-class handler — active only by default
// ---------------------------------------------------------------------------
describe("list-by-class handler", () => {
    it("returns active enrollments by default", async () => {
        const active = makeEnrollment();
        mockSend.mockResolvedValueOnce({ Items: [active] });

        const res = await listByClassHandler(
            makeEvent({ pathParameters: { class_id: "class-abc" } })
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(1);
        expect(body.status).toBe("active");

        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExpressionAttributeValues[":status"]).toBe("active");
    });

    it("returns dropped enrollments when ?status=dropped", async () => {
        const dropped = makeEnrollment({ status: "dropped", dropped_at: "2026-02-01T00:00:00.000Z" });
        mockSend.mockResolvedValueOnce({ Items: [dropped] });

        const res = await listByClassHandler(
            makeEvent({
                pathParameters: { class_id: "class-abc" },
                queryStringParameters: { status: "dropped" },
            })
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.status).toBe("dropped");
        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.ExpressionAttributeValues[":status"]).toBe("dropped");
    });

    it("returns all enrollments when ?status=all (no filter expression)", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeEnrollment(), makeEnrollment({ status: "dropped" })] });

        const res = await listByClassHandler(
            makeEvent({
                pathParameters: { class_id: "class-abc" },
                queryStringParameters: { status: "all" },
            })
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.items).toHaveLength(2);

        const [cmd] = mockSend.mock.calls[0];
        // No FilterExpression when status=all
        expect(cmd.input.FilterExpression).toBeUndefined();
    });

    it("returns 400 for invalid status filter", async () => {
        const res = await listByClassHandler(
            makeEvent({
                pathParameters: { class_id: "class-abc" },
                queryStringParameters: { status: "unknown" },
            })
        );
        expect(res.statusCode).toBe(400);
    });

    it("dropped enrollments are excluded from the default active view", async () => {
        // Default query filters by active — dropped record would not be returned by DynamoDB
        mockSend.mockResolvedValueOnce({ Items: [] });

        const res = await listByClassHandler(
            makeEvent({ pathParameters: { class_id: "class-abc" } })
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body).items).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// 5. restore handler
// ---------------------------------------------------------------------------
describe("restore handler", () => {
    it("returns 200 when restoring a dropped enrollment", async () => {
        const dropped = makeEnrollment({ status: "dropped", dropped_at: "2026-02-01T00:00:00.000Z" });
        const restored = makeEnrollment({ status: "active", restored_at: "2026-03-01T00:00:00.000Z" });

        // findEnrollmentByClassAndStudent → returns dropped record
        mockSend.mockResolvedValueOnce({ Items: [dropped] });
        // restoreEnrollment → returns updated record
        mockSend.mockResolvedValueOnce({ Attributes: restored });

        const res = await restoreHandler(
            makeEvent({ pathParameters: { class_id: "class-abc", student_id: "student-xyz" } })
        );
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.status).toBe("active");
        expect(body.restored_at).toBeDefined();
    });

    it("returns 404 when no enrollment found", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        const res = await restoreHandler(
            makeEvent({ pathParameters: { class_id: "class-abc", student_id: "student-xyz" } })
        );
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toBe("ENROLLMENT_NOT_FOUND");
    });

    it("returns 409 when enrollment is already active", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeEnrollment({ status: "active" })] });

        const res = await restoreHandler(
            makeEvent({ pathParameters: { class_id: "class-abc", student_id: "student-xyz" } })
        );
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toBe("ALREADY_ACTIVE");
    });

    it("returns 400 when path params are missing", async () => {
        const res = await restoreHandler(makeEvent({ pathParameters: { class_id: "class-abc" } }));
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// 6. enroll handler — conflict when dropped enrollment exists
// ---------------------------------------------------------------------------
describe("enroll handler — dropped enrollment conflict", () => {
    it("returns 409 ENROLLMENT_DROPPED when student was previously removed", async () => {
        const dropped = makeEnrollment({ status: "dropped" });
        mockSend.mockResolvedValueOnce({ Items: [dropped] });

        const res = await enrollHandler(
            makeEvent(
                { pathParameters: { class_id: "class-abc" } },
                { student_id: "student-xyz" }
            )
        );
        expect(res.statusCode).toBe(409);
        const body = JSON.parse(res.body);
        expect(body.error).toBe("ENROLLMENT_DROPPED");
        expect(body.enrollment_id).toBe("enroll-001");
    });

    it("returns 409 ALREADY_ENROLLED when student is already active", async () => {
        mockSend.mockResolvedValueOnce({ Items: [makeEnrollment({ status: "active" })] });

        const res = await enrollHandler(
            makeEvent(
                { pathParameters: { class_id: "class-abc" } },
                { student_id: "student-xyz" }
            )
        );
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toBe("ALREADY_ENROLLED");
    });

    it("does not create a duplicate enrollment when dropped record exists", async () => {
        const dropped = makeEnrollment({ status: "dropped" });
        mockSend.mockResolvedValueOnce({ Items: [dropped] });

        await enrollHandler(
            makeEvent(
                { pathParameters: { class_id: "class-abc" } },
                { student_id: "student-xyz" }
            )
        );

        // Only one DynamoDB call should have been made (the findEnrollmentByClassAndStudent query)
        // No PutCommand should have been issued
        expect(mockSend).toHaveBeenCalledTimes(1);
        const [cmd] = mockSend.mock.calls[0];
        expect(cmd.input.KeyConditionExpression).toBeDefined(); // QueryCommand
    });

    it("creates new enrollment when no prior record exists", async () => {
        mockSend.mockResolvedValueOnce({ Items: [] }); // no existing
        mockSend.mockResolvedValueOnce({});            // put succeeds

        const res = await enrollHandler(
            makeEvent(
                { pathParameters: { class_id: "class-abc" } },
                { student_id: "student-new" }
            )
        );
        expect(res.statusCode).toBe(201);
        expect(mockSend).toHaveBeenCalledTimes(2);
    });
});

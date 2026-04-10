/**
 * Unit tests for bossBattleSnapshots handlers:
 *   - create-snapshot.ts
 *   - get-snapshot.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/bossBattleSnapshots
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock repo — handlers only call createParticipantsSnapshot / getSnapshot
// ---------------------------------------------------------------------------
const mockCreate  = vi.fn();
const mockGetSnap = vi.fn();

vi.mock("../repo.ts", () => ({
    createParticipantsSnapshot: (...args: any[]) => mockCreate(...args),
    getSnapshot:                (...args: any[]) => mockGetSnap(...args),
}));

// ---------------------------------------------------------------------------
// Module references
// ---------------------------------------------------------------------------
let createHandler: (typeof import("../create-snapshot.ts"))["handler"];
let getHandler:    (typeof import("../get-snapshot.ts"))["handler"];

beforeAll(async () => {
    createHandler = (await import("../create-snapshot.ts")).handler;
    getHandler    = (await import("../get-snapshot.ts")).handler;
});

beforeEach(() => {
    mockCreate.mockReset();
    mockGetSnap.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSnapshot(overrides: Record<string, any> = {}) {
    return {
        snapshot_id:            "snap-1",
        boss_instance_id:       "inst-1",
        class_id:               "class-1",
        created_by_teacher_id:  "teacher-1",
        created_at:             "2026-04-09T10:00:00.000Z",
        joined_students:        [{ student_id: "s-1", guild_id: "guild-A" }],
        joined_count:           1,
        guild_counts:           { "guild-A": 1 },
        version:                1,
        ...overrides,
    };
}

function makeCreateEvent(overrides: {
    boss_instance_id?: string | null;
    sub?: string;
} = {}) {
    const pathParameters: Record<string, string> = {};
    if (overrides.boss_instance_id !== null) {
        pathParameters.boss_instance_id = overrides.boss_instance_id ?? "inst-1";
    }

    return {
        pathParameters: Object.keys(pathParameters).length ? pathParameters : undefined,
        requestContext: {
            authorizer: {
                jwt: {
                    claims: { sub: overrides.sub ?? "teacher-1" },
                },
            },
        },
    };
}

function makeGetEvent(overrides: {
    snapshot_id?: string | null;
} = {}) {
    const pathParameters: Record<string, string> = {};
    if (overrides.snapshot_id !== null) {
        pathParameters.snapshot_id = overrides.snapshot_id ?? "snap-1";
    }

    return {
        pathParameters: Object.keys(pathParameters).length ? pathParameters : undefined,
    };
}

// ---------------------------------------------------------------------------
// create-snapshot handler
// ---------------------------------------------------------------------------
describe("create-snapshot handler", () => {
    it("returns 201 with snapshot_id, joined_count, guild_counts on success", async () => {
        const snap = makeSnapshot();
        mockCreate.mockResolvedValue(snap);

        const res = await createHandler(makeCreateEvent());

        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.snapshot_id).toBe("snap-1");
        expect(body.joined_count).toBe(1);
        expect(body.guild_counts).toEqual({ "guild-A": 1 });
        expect(body.message).toContain("success");
    });

    it("returns 400 when boss_instance_id path parameter is missing", async () => {
        const res = await createHandler({ pathParameters: undefined });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("boss_instance_id");
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 400 when pathParameters exists but boss_instance_id is absent", async () => {
        const res = await createHandler({ pathParameters: {} });

        expect(res.statusCode).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 400 when repo throws 'already exists'", async () => {
        mockCreate.mockRejectedValue(new Error("Snapshot already exists for this battle"));

        const res = await createHandler(makeCreateEvent());

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("already exists");
    });

    it("returns 500 when repo throws a non-conflict error", async () => {
        mockCreate.mockRejectedValue(new Error("DynamoDB service unavailable"));

        const res = await createHandler(makeCreateEvent());

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("DynamoDB");
    });

    it("passes boss_instance_id from path parameters to repo", async () => {
        mockCreate.mockResolvedValue(makeSnapshot({ boss_instance_id: "inst-99" }));

        await createHandler(makeCreateEvent({ boss_instance_id: "inst-99" }));

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ boss_instance_id: "inst-99" })
        );
    });

    it("passes JWT sub as created_by_teacher_id when present", async () => {
        mockCreate.mockResolvedValue(makeSnapshot());

        await createHandler(makeCreateEvent({ sub: "teacher-abc" }));

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ created_by_teacher_id: "teacher-abc" })
        );
    });

    it("falls back to 'system' when JWT claims are absent", async () => {
        mockCreate.mockResolvedValue(makeSnapshot());

        await createHandler({
            pathParameters: { boss_instance_id: "inst-1" },
            requestContext: undefined,
        });

        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ created_by_teacher_id: "system" })
        );
    });
});

// ---------------------------------------------------------------------------
// get-snapshot handler
// ---------------------------------------------------------------------------
describe("get-snapshot handler", () => {
    it("returns 200 with full snapshot body on success", async () => {
        const snap = makeSnapshot();
        mockGetSnap.mockResolvedValue(snap);

        const res = await getHandler(makeGetEvent());

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.snapshot_id).toBe("snap-1");
        expect(body.joined_count).toBe(1);
        expect(body.joined_students).toHaveLength(1);
        expect(body.guild_counts).toEqual({ "guild-A": 1 });
    });

    it("returns 400 when snapshot_id path parameter is missing", async () => {
        const res = await getHandler({ pathParameters: undefined });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toContain("snapshot_id");
        expect(mockGetSnap).not.toHaveBeenCalled();
    });

    it("returns 400 when pathParameters exists but snapshot_id is absent", async () => {
        const res = await getHandler({ pathParameters: {} });

        expect(res.statusCode).toBe(400);
        expect(mockGetSnap).not.toHaveBeenCalled();
    });

    it("returns 404 when snapshot is not found", async () => {
        mockGetSnap.mockResolvedValue(null);

        const res = await getHandler(makeGetEvent());

        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body).error).toContain("not found");
    });

    it("returns 500 when repo throws", async () => {
        mockGetSnap.mockRejectedValue(new Error("ServiceUnavailable"));

        const res = await getHandler(makeGetEvent());

        expect(res.statusCode).toBe(500);
        expect(JSON.parse(res.body).error).toContain("ServiceUnavailable");
    });

    it("passes snapshot_id to repo", async () => {
        mockGetSnap.mockResolvedValue(makeSnapshot({ snapshot_id: "snap-xyz" }));

        await getHandler(makeGetEvent({ snapshot_id: "snap-xyz" }));

        expect(mockGetSnap).toHaveBeenCalledWith("snap-xyz");
    });
});

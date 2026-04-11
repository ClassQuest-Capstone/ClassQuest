import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Local repo mock                                                    */
/* ------------------------------------------------------------------ */
const mockCreateRewardMilestone       = vi.fn();
const mockGetRewardMilestoneById      = vi.fn();
const mockListRewardMilestonesByClass = vi.fn();
const mockListRewardMilestonesByTeacher = vi.fn();
const mockUpdateRewardMilestone       = vi.fn();
const mockSetRewardMilestoneStatus    = vi.fn();
const mockSoftDeleteRewardMilestone   = vi.fn();
const mockRestoreRewardMilestone      = vi.fn();

const repoExports = {
    createRewardMilestone:       (...args: any[]) => mockCreateRewardMilestone(...args),
    getRewardMilestoneById:      (...args: any[]) => mockGetRewardMilestoneById(...args),
    listRewardMilestonesByClass: (...args: any[]) => mockListRewardMilestonesByClass(...args),
    listRewardMilestonesByTeacher: (...args: any[]) => mockListRewardMilestonesByTeacher(...args),
    updateRewardMilestone:       (...args: any[]) => mockUpdateRewardMilestone(...args),
    setRewardMilestoneStatus:    (...args: any[]) => mockSetRewardMilestoneStatus(...args),
    softDeleteRewardMilestone:   (...args: any[]) => mockSoftDeleteRewardMilestone(...args),
    restoreRewardMilestone:      (...args: any[]) => mockRestoreRewardMilestone(...args),
};

vi.mock("../repo.ts", () => repoExports);
vi.mock("../repo.js", () => repoExports);

/* ------------------------------------------------------------------ */
/*  External dependency mocks (create.ts + list-student-rewards.ts)    */
/* ------------------------------------------------------------------ */
const mockListStudentsByClass                     = vi.fn();
const mockGetPlayerState                          = vi.fn();
const mockGetLevelFromXP                          = vi.fn();
const mockCreateStudentRewardClaim                = vi.fn();
const mockGetStudentRewardClaimByRewardAndStudent = vi.fn();
const mockBuildClaimSort                          = vi.fn();

vi.mock("../../classEnrollments/repo.js", () => ({
    listStudentsByClass: (...args: any[]) => mockListStudentsByClass(...args),
}));
vi.mock("../../playerStates/repo.js", () => ({
    getPlayerState: (...args: any[]) => mockGetPlayerState(...args),
}));
vi.mock("../../shared/xp-progression.js", () => ({
    getLevelFromXP: (...args: any[]) => mockGetLevelFromXP(...args),
}));
vi.mock("../../studentRewardClaims/repo.js", () => ({
    createStudentRewardClaim:                (...args: any[]) => mockCreateStudentRewardClaim(...args),
    getStudentRewardClaimByRewardAndStudent: (...args: any[]) => mockGetStudentRewardClaimByRewardAndStudent(...args),
}));
vi.mock("../../studentRewardClaims/keys.js", () => ({
    buildClaimSort: (...args: any[]) => mockBuildClaimSort(...args),
}));

/* ------------------------------------------------------------------ */
/*  Handler imports (dynamic)                                          */
/* ------------------------------------------------------------------ */
let createHandler:            (typeof import("../create.ts"))["handler"];
let getHandler:               (typeof import("../get.ts"))["handler"];
let updateHandler:            (typeof import("../update.ts"))["handler"];
let setStatusHandler:         (typeof import("../set-status.ts"))["handler"];
let softDeleteHandler:        (typeof import("../soft-delete.ts"))["handler"];
let restoreHandler:           (typeof import("../restore.ts"))["handler"];
let listByClassHandler:       (typeof import("../list-by-class.ts"))["handler"];
let listByTeacherHandler:     (typeof import("../list-by-teacher.ts"))["handler"];
let listStudentRewardsHandler:(typeof import("../list-student-rewards.ts"))["handler"];

beforeAll(async () => {
    createHandler            = (await import("../create.ts")).handler;
    getHandler               = (await import("../get.ts")).handler;
    updateHandler            = (await import("../update.ts")).handler;
    setStatusHandler         = (await import("../set-status.ts")).handler;
    softDeleteHandler        = (await import("../soft-delete.ts")).handler;
    restoreHandler           = (await import("../restore.ts")).handler;
    listByClassHandler       = (await import("../list-by-class.ts")).handler;
    listByTeacherHandler     = (await import("../list-by-teacher.ts")).handler;
    listStudentRewardsHandler = (await import("../list-student-rewards.ts")).handler;
});

beforeEach(() => {
    mockCreateRewardMilestone.mockReset();
    mockGetRewardMilestoneById.mockReset();
    mockListRewardMilestonesByClass.mockReset();
    mockListRewardMilestonesByTeacher.mockReset();
    mockUpdateRewardMilestone.mockReset();
    mockSetRewardMilestoneStatus.mockReset();
    mockSoftDeleteRewardMilestone.mockReset();
    mockRestoreRewardMilestone.mockReset();
    mockListStudentsByClass.mockReset();
    mockGetPlayerState.mockReset();
    mockGetLevelFromXP.mockReset();
    mockCreateStudentRewardClaim.mockReset();
    mockGetStudentRewardClaimByRewardAndStudent.mockReset();
    mockBuildClaimSort.mockReset();

    // Defaults: no enrolled students (seeding loop skipped)
    mockListStudentsByClass.mockResolvedValue([]);
    mockBuildClaimSort.mockReturnValue("AVAILABLE#class-1#00005#r-1");
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function makeEvent(overrides: {
    body?: object | string;
    pathParameters?: Record<string, string>;
    queryStringParameters?: Record<string, string>;
} = {}) {
    return {
        body: overrides.body
            ? typeof overrides.body === "string"
                ? overrides.body
                : JSON.stringify(overrides.body)
            : undefined,
        pathParameters: overrides.pathParameters,
        queryStringParameters: overrides.queryStringParameters ?? undefined,
    };
}

function parseBody(res: any) {
    return JSON.parse(res.body);
}

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
/*  create handler                                                     */
/* ================================================================== */
describe("create handler", () => {
    const validBody = {
        class_id: "class-1",
        created_by_teacher_id: "teacher-1",
        title: "Copper Helmet",
        description: "A sturdy helmet.",
        unlock_level: 5,
        type: "HELMET",
        reward_target_type: "ITEM",
        reward_target_id: "item-1",
    };

    it("returns 201 on success", async () => {
        mockCreateRewardMilestone.mockResolvedValue(undefined);

        const res = await createHandler(makeEvent({ body: validBody }));

        expect(res.statusCode).toBe(201);
        const body = parseBody(res);
        expect(body.reward_id).toBeDefined();
        expect(body.title).toBe("Copper Helmet");
        expect(mockCreateRewardMilestone).toHaveBeenCalledOnce();
    });

    it("returns 400 on validation failure (missing required fields)", async () => {
        const res = await createHandler(makeEvent({ body: { title: "X" } }));
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("VALIDATION_FAILED");
    });

    it("returns 400 when created_by_teacher_id is missing", async () => {
        const body = { ...validBody };
        delete (body as any).created_by_teacher_id;

        const res = await createHandler(makeEvent({ body }));
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_FIELD");
    });

    it("returns 409 on ConditionalCheckFailedException", async () => {
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockCreateRewardMilestone.mockRejectedValue(err);

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(409);
        expect(parseBody(res).error).toBe("REWARD_ALREADY_EXISTS");
    });

    it("returns 500 on unexpected repo error", async () => {
        mockCreateRewardMilestone.mockRejectedValue(new Error("boom"));

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(500);
    });

    it("defaults is_active to true", async () => {
        mockCreateRewardMilestone.mockResolvedValue(undefined);

        const res = await createHandler(makeEvent({ body: validBody }));
        const body = parseBody(res);
        expect(body.is_active).toBe(true);
    });

    it("respects explicit is_active=false", async () => {
        mockCreateRewardMilestone.mockResolvedValue(undefined);

        const res = await createHandler(
            makeEvent({ body: { ...validBody, is_active: false } })
        );
        const body = parseBody(res);
        expect(body.is_active).toBe(false);
    });

    it("still returns 201 when student seeding fails (non-fatal)", async () => {
        mockCreateRewardMilestone.mockResolvedValue(undefined);
        mockListStudentsByClass.mockRejectedValue(new Error("enrollment service down"));

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(201);
    });
});

/* ================================================================== */
/*  get handler                                                        */
/* ================================================================== */
describe("get handler", () => {
    it("returns 200 with item when found", async () => {
        const reward = makeReward();
        mockGetRewardMilestoneById.mockResolvedValue(reward);

        const res = await getHandler(
            makeEvent({ pathParameters: { reward_id: "r-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res)).toEqual(reward);
    });

    it("returns 400 when reward_id is missing", async () => {
        const res = await getHandler(makeEvent());
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_REWARD_ID");
    });

    it("returns 404 when not found", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(null);

        const res = await getHandler(
            makeEvent({ pathParameters: { reward_id: "missing" } })
        );
        expect(res.statusCode).toBe(404);
        expect(parseBody(res).error).toBe("REWARD_NOT_FOUND");
    });

    it("returns 500 on repo error", async () => {
        mockGetRewardMilestoneById.mockRejectedValue(new Error("boom"));

        const res = await getHandler(
            makeEvent({ pathParameters: { reward_id: "r-1" } })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  update handler                                                     */
/* ================================================================== */
describe("update handler", () => {
    it("returns 200 on success", async () => {
        const existing = makeReward();
        const updated = makeReward({ title: "New Title" });
        mockGetRewardMilestoneById
            .mockResolvedValueOnce(existing)   // pre-update fetch
            .mockResolvedValueOnce(updated);    // post-update fetch
        mockUpdateRewardMilestone.mockResolvedValue(undefined);

        const res = await updateHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { title: "New Title" },
            })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).title).toBe("New Title");
    });

    it("returns 400 when reward_id is missing", async () => {
        const res = await updateHandler(makeEvent({ body: { title: "X" } }));
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_REWARD_ID");
    });

    it("returns 400 on validation failure", async () => {
        const res = await updateHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { title: "" },
            })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("VALIDATION_FAILED");
    });

    it("returns 404 when reward not found (get)", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(null);

        const res = await updateHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { title: "X" },
            })
        );
        expect(res.statusCode).toBe(404);
    });

    it("returns 404 on ConditionalCheckFailedException from update", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(makeReward());
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockUpdateRewardMilestone.mockRejectedValue(err);

        const res = await updateHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { title: "X" },
            })
        );
        expect(res.statusCode).toBe(404);
    });

    it("returns 500 when get fails", async () => {
        mockGetRewardMilestoneById.mockRejectedValue(new Error("boom"));

        const res = await updateHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { title: "X" },
            })
        );
        expect(res.statusCode).toBe(500);
    });

    it("returns 500 when update fails unexpectedly", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(makeReward());
        mockUpdateRewardMilestone.mockRejectedValue(new Error("boom"));

        const res = await updateHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { title: "X" },
            })
        );
        expect(res.statusCode).toBe(500);
    });

    it("forwards current values for sort key recomputation", async () => {
        const existing = makeReward({ class_id: "c-1", is_active: true, unlock_level: 5, type: "HELMET" });
        mockGetRewardMilestoneById
            .mockResolvedValueOnce(existing)
            .mockResolvedValueOnce(existing);
        mockUpdateRewardMilestone.mockResolvedValue(undefined);

        await updateHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { unlock_level: 10 },
            })
        );

        const [, updates] = mockUpdateRewardMilestone.mock.calls[0];
        expect(updates.current_class_id).toBe("c-1");
        expect(updates.current_is_active).toBe(true);
        expect(updates.current_unlock_level).toBe(5);
        expect(updates.current_type).toBe("HELMET");
        expect(updates.unlock_level).toBe(10);
    });
});

/* ================================================================== */
/*  set-status handler                                                 */
/* ================================================================== */
describe("set-status handler", () => {
    it("returns 200 on successful activation", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(makeReward({ is_active: false }));
        mockSetRewardMilestoneStatus.mockResolvedValue(undefined);

        const res = await setStatusHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { is_active: true },
            })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).is_active).toBe(true);
        expect(parseBody(res).message).toContain("activated");
    });

    it("returns 200 on successful deactivation", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(makeReward());
        mockSetRewardMilestoneStatus.mockResolvedValue(undefined);

        const res = await setStatusHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { is_active: false },
            })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).message).toContain("deactivated");
    });

    it("returns 400 when reward_id is missing", async () => {
        const res = await setStatusHandler(makeEvent({ body: { is_active: true } }));
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_REWARD_ID");
    });

    it("returns 400 when is_active is not boolean", async () => {
        const res = await setStatusHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { is_active: "yes" },
            })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("VALIDATION_FAILED");
    });

    it("returns 404 when reward not found", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(null);

        const res = await setStatusHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { is_active: true },
            })
        );
        expect(res.statusCode).toBe(404);
    });

    it("returns 404 on ConditionalCheckFailedException", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(makeReward());
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSetRewardMilestoneStatus.mockRejectedValue(err);

        const res = await setStatusHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { is_active: true },
            })
        );
        expect(res.statusCode).toBe(404);
    });

    it("returns 500 when get fails", async () => {
        mockGetRewardMilestoneById.mockRejectedValue(new Error("boom"));

        const res = await setStatusHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { is_active: true },
            })
        );
        expect(res.statusCode).toBe(500);
    });

    it("returns 500 when setStatus fails unexpectedly", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(makeReward());
        mockSetRewardMilestoneStatus.mockRejectedValue(new Error("boom"));

        const res = await setStatusHandler(
            makeEvent({
                pathParameters: { reward_id: "r-1" },
                body: { is_active: true },
            })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  soft-delete handler                                                */
/* ================================================================== */
describe("soft-delete handler", () => {
    it("returns 200 on success", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(makeReward());
        mockSoftDeleteRewardMilestone.mockResolvedValue(undefined);

        const res = await softDeleteHandler(
            makeEvent({ pathParameters: { reward_id: "r-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).message).toContain("soft-deleted");
    });

    it("returns 400 when reward_id is missing", async () => {
        const res = await softDeleteHandler(makeEvent());
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_REWARD_ID");
    });

    it("returns 404 when reward not found", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(null);

        const res = await softDeleteHandler(
            makeEvent({ pathParameters: { reward_id: "missing" } })
        );
        expect(res.statusCode).toBe(404);
    });

    it("returns 404 on ConditionalCheckFailedException", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(makeReward());
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockSoftDeleteRewardMilestone.mockRejectedValue(err);

        const res = await softDeleteHandler(
            makeEvent({ pathParameters: { reward_id: "r-1" } })
        );
        expect(res.statusCode).toBe(404);
    });

    it("returns 500 when get fails", async () => {
        mockGetRewardMilestoneById.mockRejectedValue(new Error("boom"));

        const res = await softDeleteHandler(
            makeEvent({ pathParameters: { reward_id: "r-1" } })
        );
        expect(res.statusCode).toBe(500);
    });

    it("returns 500 when softDelete fails unexpectedly", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(makeReward());
        mockSoftDeleteRewardMilestone.mockRejectedValue(new Error("boom"));

        const res = await softDeleteHandler(
            makeEvent({ pathParameters: { reward_id: "r-1" } })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  restore handler                                                    */
/* ================================================================== */
describe("restore handler", () => {
    it("returns 200 on success", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(makeReward({ is_deleted: true }));
        mockRestoreRewardMilestone.mockResolvedValue(undefined);

        const res = await restoreHandler(
            makeEvent({ pathParameters: { reward_id: "r-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).message).toContain("restored");
    });

    it("returns 400 when reward_id is missing", async () => {
        const res = await restoreHandler(makeEvent());
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_REWARD_ID");
    });

    it("returns 404 when reward not found", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(null);

        const res = await restoreHandler(
            makeEvent({ pathParameters: { reward_id: "missing" } })
        );
        expect(res.statusCode).toBe(404);
    });

    it("returns 404 on ConditionalCheckFailedException", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(makeReward());
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockRestoreRewardMilestone.mockRejectedValue(err);

        const res = await restoreHandler(
            makeEvent({ pathParameters: { reward_id: "r-1" } })
        );
        expect(res.statusCode).toBe(404);
    });

    it("returns 500 when get fails", async () => {
        mockGetRewardMilestoneById.mockRejectedValue(new Error("boom"));

        const res = await restoreHandler(
            makeEvent({ pathParameters: { reward_id: "r-1" } })
        );
        expect(res.statusCode).toBe(500);
    });

    it("returns 500 when restore fails unexpectedly", async () => {
        mockGetRewardMilestoneById.mockResolvedValue(makeReward());
        mockRestoreRewardMilestone.mockRejectedValue(new Error("boom"));

        const res = await restoreHandler(
            makeEvent({ pathParameters: { reward_id: "r-1" } })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  list-by-class handler                                              */
/* ================================================================== */
describe("list-by-class handler", () => {
    it("returns 200 with items", async () => {
        const items = [makeReward()];
        mockListRewardMilestonesByClass.mockResolvedValue(items);

        const res = await listByClassHandler(
            makeEvent({ pathParameters: { class_id: "class-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual(items);
    });

    it("returns 200 with empty array", async () => {
        mockListRewardMilestonesByClass.mockResolvedValue([]);

        const res = await listByClassHandler(
            makeEvent({ pathParameters: { class_id: "class-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual([]);
    });

    it("forwards include_deleted=true", async () => {
        mockListRewardMilestonesByClass.mockResolvedValue([]);

        await listByClassHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { include_deleted: "true" },
            })
        );

        expect(mockListRewardMilestonesByClass).toHaveBeenCalledWith("class-1", { includeDeleted: true });
    });

    it("defaults include_deleted to false", async () => {
        mockListRewardMilestonesByClass.mockResolvedValue([]);

        await listByClassHandler(
            makeEvent({ pathParameters: { class_id: "class-1" } })
        );

        expect(mockListRewardMilestonesByClass).toHaveBeenCalledWith("class-1", { includeDeleted: false });
    });

    it("returns 400 when class_id is missing", async () => {
        const res = await listByClassHandler(makeEvent());
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_CLASS_ID");
    });

    it("returns 500 on repo error", async () => {
        mockListRewardMilestonesByClass.mockRejectedValue(new Error("boom"));

        const res = await listByClassHandler(
            makeEvent({ pathParameters: { class_id: "class-1" } })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  list-by-teacher handler                                            */
/* ================================================================== */
describe("list-by-teacher handler", () => {
    it("returns 200 with items", async () => {
        const items = [makeReward()];
        mockListRewardMilestonesByTeacher.mockResolvedValue(items);

        const res = await listByTeacherHandler(
            makeEvent({ queryStringParameters: { teacher_id: "teacher-1" } })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual(items);
    });

    it("returns 200 with empty array", async () => {
        mockListRewardMilestonesByTeacher.mockResolvedValue([]);

        const res = await listByTeacherHandler(
            makeEvent({ queryStringParameters: { teacher_id: "teacher-1" } })
        );

        expect(parseBody(res).items).toEqual([]);
    });

    it("forwards include_deleted=true", async () => {
        mockListRewardMilestonesByTeacher.mockResolvedValue([]);

        await listByTeacherHandler(
            makeEvent({
                queryStringParameters: { teacher_id: "t-1", include_deleted: "true" },
            })
        );

        expect(mockListRewardMilestonesByTeacher).toHaveBeenCalledWith("t-1", { includeDeleted: true });
    });

    it("returns 400 when teacher_id is missing", async () => {
        const res = await listByTeacherHandler(makeEvent());
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_TEACHER_ID");
    });

    it("returns 500 on repo error", async () => {
        mockListRewardMilestonesByTeacher.mockRejectedValue(new Error("boom"));

        const res = await listByTeacherHandler(
            makeEvent({ queryStringParameters: { teacher_id: "teacher-1" } })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  list-student-rewards handler                                       */
/* ================================================================== */
describe("list-student-rewards handler", () => {
    it("returns 200 with locked/unlocked rewards and student_level", async () => {
        const rewards = [
            makeReward({ reward_id: "r-1", unlock_level: 3, is_active: true, is_deleted: false }),
            makeReward({ reward_id: "r-2", unlock_level: 10, is_active: true, is_deleted: false }),
        ];
        mockListRewardMilestonesByClass.mockResolvedValue(rewards);
        mockGetPlayerState.mockResolvedValue({ total_xp_earned: 500 });
        mockGetLevelFromXP.mockReturnValue(5);

        const res = await listStudentRewardsHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { student_id: "student-1" },
            })
        );

        expect(res.statusCode).toBe(200);
        const body = parseBody(res);
        expect(body.student_level).toBe(5);
        expect(body.items).toHaveLength(2);

        // r-1 at level 3 is unlocked for student at level 5
        expect(body.items[0].unlocked).toBe(true);
        expect(body.items[0].locked).toBe(false);

        // r-2 at level 10 is locked for student at level 5
        expect(body.items[1].unlocked).toBe(false);
        expect(body.items[1].locked).toBe(true);
    });

    it("returns 400 when class_id is missing", async () => {
        const res = await listStudentRewardsHandler(
            makeEvent({ queryStringParameters: { student_id: "s-1" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_CLASS_ID");
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await listStudentRewardsHandler(
            makeEvent({ pathParameters: { class_id: "class-1" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_STUDENT_ID");
    });

    it("returns empty items when no active rewards", async () => {
        mockListRewardMilestonesByClass.mockResolvedValue([]);
        mockGetPlayerState.mockResolvedValue({ total_xp_earned: 0 });
        mockGetLevelFromXP.mockReturnValue(1);

        const res = await listStudentRewardsHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { student_id: "s-1" },
            })
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual([]);
    });

    it("defaults to level 1 when no player state", async () => {
        mockListRewardMilestonesByClass.mockResolvedValue([
            makeReward({ unlock_level: 1, is_active: true }),
        ]);
        mockGetPlayerState.mockResolvedValue(null);

        const res = await listStudentRewardsHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { student_id: "s-1" },
            })
        );

        expect(res.statusCode).toBe(200);
        const body = parseBody(res);
        expect(body.student_level).toBe(1);
        expect(body.items[0].unlocked).toBe(true);
    });

    it("filters out inactive rewards", async () => {
        const rewards = [
            makeReward({ reward_id: "r-1", is_active: true }),
            makeReward({ reward_id: "r-2", is_active: false }),
        ];
        mockListRewardMilestonesByClass.mockResolvedValue(rewards);
        mockGetPlayerState.mockResolvedValue({ total_xp_earned: 0 });
        mockGetLevelFromXP.mockReturnValue(1);

        const res = await listStudentRewardsHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { student_id: "s-1" },
            })
        );

        expect(parseBody(res).items).toHaveLength(1);
    });

    it("returns 500 on repo error", async () => {
        mockListRewardMilestonesByClass.mockRejectedValue(new Error("boom"));

        const res = await listStudentRewardsHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { student_id: "s-1" },
            })
        );
        expect(res.statusCode).toBe(500);
    });
});

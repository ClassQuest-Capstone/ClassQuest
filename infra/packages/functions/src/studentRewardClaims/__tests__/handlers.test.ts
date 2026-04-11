import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Local repo mock                                                    */
/* ------------------------------------------------------------------ */
const mockCreateStudentRewardClaim              = vi.fn();
const mockGetStudentRewardClaimById             = vi.fn();
const mockListStudentRewardClaimsByStudent       = vi.fn();
const mockListStudentRewardClaimsByStudentAndClass = vi.fn();
const mockGetStudentRewardClaimByRewardAndStudent  = vi.fn();
const mockUpdateStudentRewardClaimStatus         = vi.fn();

const repoExports = {
    createStudentRewardClaim:              (...args: any[]) => mockCreateStudentRewardClaim(...args),
    getStudentRewardClaimById:             (...args: any[]) => mockGetStudentRewardClaimById(...args),
    listStudentRewardClaimsByStudent:       (...args: any[]) => mockListStudentRewardClaimsByStudent(...args),
    listStudentRewardClaimsByStudentAndClass: (...args: any[]) => mockListStudentRewardClaimsByStudentAndClass(...args),
    getStudentRewardClaimByRewardAndStudent:  (...args: any[]) => mockGetStudentRewardClaimByRewardAndStudent(...args),
    updateStudentRewardClaimStatus:         (...args: any[]) => mockUpdateStudentRewardClaimStatus(...args),
};

vi.mock("../repo.ts", () => repoExports);
vi.mock("../repo.js", () => repoExports);

/* ------------------------------------------------------------------ */
/*  External dependency mocks                                          */
/* ------------------------------------------------------------------ */
const mockListRewardMilestonesByClass = vi.fn();
const mockGetRewardMilestoneById      = vi.fn();
const mockGetPlayerState              = vi.fn();
const mockGetLevelFromXP              = vi.fn();

vi.mock("../../rewardMilestones/repo.ts", () => ({
    listRewardMilestonesByClass: (...args: any[]) => mockListRewardMilestonesByClass(...args),
    getRewardMilestoneById:      (...args: any[]) => mockGetRewardMilestoneById(...args),
}));
vi.mock("../../rewardMilestones/repo.js", () => ({
    listRewardMilestonesByClass: (...args: any[]) => mockListRewardMilestonesByClass(...args),
    getRewardMilestoneById:      (...args: any[]) => mockGetRewardMilestoneById(...args),
}));
vi.mock("../../playerStates/repo.js", () => ({
    getPlayerState: (...args: any[]) => mockGetPlayerState(...args),
}));
vi.mock("../../playerStates/repo.ts", () => ({
    getPlayerState: (...args: any[]) => mockGetPlayerState(...args),
}));
vi.mock("../../shared/xp-progression.js", () => ({
    getLevelFromXP: (...args: any[]) => mockGetLevelFromXP(...args),
}));

/* ------------------------------------------------------------------ */
/*  Handler imports (dynamic)                                          */
/* ------------------------------------------------------------------ */
let createHandler:        (typeof import("../create.ts"))["handler"];
let getHandler:           (typeof import("../get.ts"))["handler"];
let claimRewardHandler:   (typeof import("../claim-reward.ts"))["handler"];
let levelUpSyncHandler:   (typeof import("../level-up-sync.ts"))["handler"];
let listByStudentHandler: (typeof import("../list-by-student.ts"))["handler"];
let listInternalHandler:  (typeof import("../list-internal.ts"))["handler"];
let rewardsStateHandler:  (typeof import("../rewards-state.ts"))["handler"];

beforeAll(async () => {
    createHandler        = (await import("../create.ts")).handler;
    getHandler           = (await import("../get.ts")).handler;
    claimRewardHandler   = (await import("../claim-reward.ts")).handler;
    levelUpSyncHandler   = (await import("../level-up-sync.ts")).handler;
    listByStudentHandler = (await import("../list-by-student.ts")).handler;
    listInternalHandler  = (await import("../list-internal.ts")).handler;
    rewardsStateHandler  = (await import("../rewards-state.ts")).handler;
});

beforeEach(() => {
    mockCreateStudentRewardClaim.mockReset();
    mockGetStudentRewardClaimById.mockReset();
    mockListStudentRewardClaimsByStudent.mockReset();
    mockListStudentRewardClaimsByStudentAndClass.mockReset();
    mockGetStudentRewardClaimByRewardAndStudent.mockReset();
    mockUpdateStudentRewardClaimStatus.mockReset();
    mockListRewardMilestonesByClass.mockReset();
    mockGetRewardMilestoneById.mockReset();
    mockGetPlayerState.mockReset();
    mockGetLevelFromXP.mockReset();
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

function makeClaim(overrides: Record<string, any> = {}) {
    return {
        student_reward_claim_id: "claim-1",
        student_id: "stu-1",
        class_id: "class-1",
        reward_id: "reward-1",
        status: "AVAILABLE",
        unlocked_at_level: 5,
        claim_sort: "AVAILABLE#class-1#00005#reward-1",
        unlocked_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        reward_target_type: "ITEM",
        reward_target_id: "item-1",
        ...overrides,
    };
}

function makeMilestone(overrides: Record<string, any> = {}) {
    return {
        reward_id: "reward-1",
        title: "Copper Helmet",
        description: "A helmet",
        unlock_level: 5,
        type: "HELMET",
        is_active: true,
        is_deleted: false,
        image_asset_key: "helmets/copper.png",
        reward_target_type: "ITEM",
        reward_target_id: "item-1",
        ...overrides,
    };
}

/* ================================================================== */
/*  create handler                                                     */
/* ================================================================== */
describe("create handler", () => {
    const validBody = {
        student_id: "stu-1",
        class_id: "class-1",
        reward_id: "reward-1",
        status: "AVAILABLE",
        unlocked_at_level: 5,
        reward_target_type: "ITEM",
        reward_target_id: "item-1",
    };

    it("returns 201 on success", async () => {
        mockGetStudentRewardClaimByRewardAndStudent.mockResolvedValue(null);
        mockCreateStudentRewardClaim.mockResolvedValue(undefined);

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(201);
        expect(parseBody(res).student_reward_claim_id).toBeDefined();
    });

    it("returns 400 on validation failure", async () => {
        const res = await createHandler(makeEvent({ body: { status: "AVAILABLE" } }));
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("VALIDATION_FAILED");
    });

    it("returns 409 when claim already exists (duplicate check)", async () => {
        mockGetStudentRewardClaimByRewardAndStudent.mockResolvedValue(makeClaim());

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(409);
        expect(parseBody(res).error).toBe("CLAIM_ALREADY_EXISTS");
    });

    it("returns 409 on ConditionalCheckFailedException", async () => {
        mockGetStudentRewardClaimByRewardAndStudent.mockResolvedValue(null);
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockCreateStudentRewardClaim.mockRejectedValue(err);

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(409);
    });

    it("returns 500 on unexpected error", async () => {
        mockGetStudentRewardClaimByRewardAndStudent.mockResolvedValue(null);
        mockCreateStudentRewardClaim.mockRejectedValue(new Error("boom"));

        const res = await createHandler(makeEvent({ body: validBody }));
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  get handler                                                        */
/* ================================================================== */
describe("get handler", () => {
    it("returns 200 with claim", async () => {
        const claim = makeClaim();
        mockGetStudentRewardClaimById.mockResolvedValue(claim);

        const res = await getHandler(makeEvent({ pathParameters: { claim_id: "claim-1" } }));
        expect(res.statusCode).toBe(200);
        expect(parseBody(res)).toEqual(claim);
    });

    it("returns 400 when claim_id is missing", async () => {
        const res = await getHandler(makeEvent());
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_CLAIM_ID");
    });

    it("returns 404 when not found", async () => {
        mockGetStudentRewardClaimById.mockResolvedValue(null);
        const res = await getHandler(makeEvent({ pathParameters: { claim_id: "missing" } }));
        expect(res.statusCode).toBe(404);
    });

    it("returns 500 on repo error", async () => {
        mockGetStudentRewardClaimById.mockRejectedValue(new Error("boom"));
        const res = await getHandler(makeEvent({ pathParameters: { claim_id: "claim-1" } }));
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  claim-reward handler                                               */
/* ================================================================== */
describe("claim-reward handler", () => {
    it("returns 200 when claiming an existing AVAILABLE reward", async () => {
        mockGetStudentRewardClaimByRewardAndStudent.mockResolvedValue(makeClaim({ status: "AVAILABLE" }));
        mockUpdateStudentRewardClaimStatus.mockResolvedValue(undefined);

        const res = await claimRewardHandler(
            makeEvent({
                pathParameters: { reward_id: "reward-1" },
                body: { student_id: "stu-1", class_id: "class-1" },
            })
        );
        expect(res.statusCode).toBe(200);
        expect(parseBody(res).status).toBe("CLAIMED");
    });

    it("auto-creates claim and transitions when no claim exists", async () => {
        mockGetStudentRewardClaimByRewardAndStudent.mockResolvedValue(null);
        mockGetRewardMilestoneById.mockResolvedValue(makeMilestone({ unlock_level: 5 }));
        mockGetPlayerState.mockResolvedValue({ total_xp_earned: 500 }); // level 6
        mockCreateStudentRewardClaim.mockResolvedValue(undefined);
        mockUpdateStudentRewardClaimStatus.mockResolvedValue(undefined);

        const res = await claimRewardHandler(
            makeEvent({
                pathParameters: { reward_id: "reward-1" },
                body: { student_id: "stu-1", class_id: "class-1" },
            })
        );
        expect(res.statusCode).toBe(200);
        expect(mockCreateStudentRewardClaim).toHaveBeenCalledOnce();
        expect(mockUpdateStudentRewardClaimStatus).toHaveBeenCalledOnce();
    });

    it("returns 400 when reward_id is missing", async () => {
        const res = await claimRewardHandler(
            makeEvent({ body: { student_id: "stu-1", class_id: "class-1" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_REWARD_ID");
    });

    it("returns 400 when student_id or class_id is missing", async () => {
        const res = await claimRewardHandler(
            makeEvent({ pathParameters: { reward_id: "r-1" }, body: {} })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_FIELDS");
    });

    it("returns 404 when reward does not exist (auto-create path)", async () => {
        mockGetStudentRewardClaimByRewardAndStudent.mockResolvedValue(null);
        mockGetRewardMilestoneById.mockResolvedValue(null);

        const res = await claimRewardHandler(
            makeEvent({
                pathParameters: { reward_id: "reward-1" },
                body: { student_id: "stu-1", class_id: "class-1" },
            })
        );
        expect(res.statusCode).toBe(404);
        expect(parseBody(res).error).toBe("REWARD_NOT_FOUND");
    });

    it("returns 403 when student level is below unlock_level", async () => {
        mockGetStudentRewardClaimByRewardAndStudent.mockResolvedValue(null);
        mockGetRewardMilestoneById.mockResolvedValue(makeMilestone({ unlock_level: 10 }));
        mockGetPlayerState.mockResolvedValue({ total_xp_earned: 200 }); // level 3

        const res = await claimRewardHandler(
            makeEvent({
                pathParameters: { reward_id: "reward-1" },
                body: { student_id: "stu-1", class_id: "class-1" },
            })
        );
        expect(res.statusCode).toBe(403);
        expect(parseBody(res).error).toBe("LEVEL_NOT_REACHED");
    });

    it("returns 409 when already claimed", async () => {
        mockGetStudentRewardClaimByRewardAndStudent.mockResolvedValue(
            makeClaim({ status: "CLAIMED", claimed_at: "2026-01-02T00:00:00.000Z" })
        );

        const res = await claimRewardHandler(
            makeEvent({
                pathParameters: { reward_id: "reward-1" },
                body: { student_id: "stu-1", class_id: "class-1" },
            })
        );
        expect(res.statusCode).toBe(409);
        expect(parseBody(res).error).toBe("ALREADY_CLAIMED");
    });

    it("returns 409 on ConditionalCheckFailedException (race condition)", async () => {
        mockGetStudentRewardClaimByRewardAndStudent.mockResolvedValue(makeClaim({ status: "AVAILABLE" }));
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockUpdateStudentRewardClaimStatus.mockRejectedValue(err);

        const res = await claimRewardHandler(
            makeEvent({
                pathParameters: { reward_id: "reward-1" },
                body: { student_id: "stu-1", class_id: "class-1" },
            })
        );
        expect(res.statusCode).toBe(409);
    });

    it("returns 500 on unexpected error", async () => {
        mockGetStudentRewardClaimByRewardAndStudent.mockRejectedValue(new Error("boom"));

        const res = await claimRewardHandler(
            makeEvent({
                pathParameters: { reward_id: "reward-1" },
                body: { student_id: "stu-1", class_id: "class-1" },
            })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  level-up-sync handler                                              */
/* ================================================================== */
describe("level-up-sync handler", () => {
    it("creates claims for crossed milestones", async () => {
        mockListRewardMilestonesByClass.mockResolvedValue([
            makeMilestone({ reward_id: "r-3", unlock_level: 3, is_active: true, is_deleted: false }),
            makeMilestone({ reward_id: "r-5", unlock_level: 5, is_active: true, is_deleted: false }),
            makeMilestone({ reward_id: "r-8", unlock_level: 8, is_active: true, is_deleted: false }),
        ]);
        mockGetStudentRewardClaimByRewardAndStudent.mockResolvedValue(null);
        mockCreateStudentRewardClaim.mockResolvedValue(undefined);

        const res = await levelUpSyncHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { class_id: "class-1", old_level: 2, new_level: 6 },
            })
        );

        expect(res.statusCode).toBe(200);
        const body = parseBody(res);
        expect(body.created_count).toBe(2); // r-3 (level 3) and r-5 (level 5), not r-8
    });

    it("returns 200 no-op when new_level <= old_level", async () => {
        const res = await levelUpSyncHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { class_id: "class-1", old_level: 5, new_level: 5 },
            })
        );
        expect(res.statusCode).toBe(200);
        expect(parseBody(res).created_count).toBe(0);
    });

    it("skips milestones with existing claims (idempotent)", async () => {
        mockListRewardMilestonesByClass.mockResolvedValue([
            makeMilestone({ reward_id: "r-3", unlock_level: 3, is_active: true, is_deleted: false }),
        ]);
        mockGetStudentRewardClaimByRewardAndStudent.mockResolvedValue(makeClaim()); // already exists
        mockCreateStudentRewardClaim.mockResolvedValue(undefined);

        const res = await levelUpSyncHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { class_id: "class-1", old_level: 1, new_level: 5 },
            })
        );
        expect(parseBody(res).created_count).toBe(0);
        expect(mockCreateStudentRewardClaim).not.toHaveBeenCalled();
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await levelUpSyncHandler(
            makeEvent({ body: { class_id: "c-1", old_level: 1, new_level: 5 } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_STUDENT_ID");
    });

    it("returns 400 when class_id is missing", async () => {
        const res = await levelUpSyncHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { old_level: 1, new_level: 5 },
            })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid old_level", async () => {
        const res = await levelUpSyncHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { class_id: "c-1", old_level: -1, new_level: 5 },
            })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid new_level", async () => {
        const res = await levelUpSyncHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { class_id: "c-1", old_level: 0, new_level: 0 },
            })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 500 on repo error", async () => {
        mockListRewardMilestonesByClass.mockRejectedValue(new Error("boom"));

        const res = await levelUpSyncHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { class_id: "c-1", old_level: 1, new_level: 5 },
            })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  list-by-student handler                                            */
/* ================================================================== */
describe("list-by-student handler", () => {
    it("returns 200 with items", async () => {
        const items = [makeClaim()];
        mockListStudentRewardClaimsByStudentAndClass.mockResolvedValue(items);

        const res = await listByStudentHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { student_id: "stu-1" },
            })
        );
        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual(items);
    });

    it("returns 400 when class_id is missing", async () => {
        const res = await listByStudentHandler(
            makeEvent({ queryStringParameters: { student_id: "stu-1" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_CLASS_ID");
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await listByStudentHandler(
            makeEvent({ pathParameters: { class_id: "class-1" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_STUDENT_ID");
    });

    it("returns 400 for invalid status filter", async () => {
        const res = await listByStudentHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { student_id: "stu-1", status: "PENDING" },
            })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("INVALID_STATUS");
    });

    it("forwards status filter to repo", async () => {
        mockListStudentRewardClaimsByStudentAndClass.mockResolvedValue([]);

        await listByStudentHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { student_id: "stu-1", status: "AVAILABLE" },
            })
        );

        expect(mockListStudentRewardClaimsByStudentAndClass).toHaveBeenCalledWith(
            "stu-1", "class-1", { status: "AVAILABLE" }
        );
    });

    it("returns 500 on repo error", async () => {
        mockListStudentRewardClaimsByStudentAndClass.mockRejectedValue(new Error("boom"));

        const res = await listByStudentHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { student_id: "stu-1" },
            })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  list-internal handler                                              */
/* ================================================================== */
describe("list-internal handler", () => {
    it("returns 200 listing all claims for a student", async () => {
        const items = [makeClaim()];
        mockListStudentRewardClaimsByStudent.mockResolvedValue(items);

        const res = await listInternalHandler(
            makeEvent({ pathParameters: { student_id: "stu-1" } })
        );
        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual(items);
    });

    it("uses class filter when class_id provided", async () => {
        mockListStudentRewardClaimsByStudentAndClass.mockResolvedValue([]);

        await listInternalHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                queryStringParameters: { class_id: "class-1" },
            })
        );
        expect(mockListStudentRewardClaimsByStudentAndClass).toHaveBeenCalledWith(
            "stu-1", "class-1", undefined
        );
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await listInternalHandler(makeEvent());
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_STUDENT_ID");
    });

    it("returns 400 for invalid status filter", async () => {
        const res = await listInternalHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                queryStringParameters: { status: "NOPE" },
            })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 500 on repo error", async () => {
        mockListStudentRewardClaimsByStudent.mockRejectedValue(new Error("boom"));

        const res = await listInternalHandler(
            makeEvent({ pathParameters: { student_id: "stu-1" } })
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  rewards-state handler                                              */
/* ================================================================== */
describe("rewards-state handler", () => {
    it("returns merged state with LOCKED/AVAILABLE/CLAIMED", async () => {
        mockGetPlayerState.mockResolvedValue({ total_xp_earned: 500 });
        mockGetLevelFromXP.mockReturnValue(6);
        mockListRewardMilestonesByClass.mockResolvedValue([
            makeMilestone({ reward_id: "r-claimed", unlock_level: 3 }),
            makeMilestone({ reward_id: "r-available-claim", unlock_level: 5 }),
            makeMilestone({ reward_id: "r-available-level", unlock_level: 6 }),
            makeMilestone({ reward_id: "r-locked", unlock_level: 10 }),
        ]);
        mockListStudentRewardClaimsByStudentAndClass.mockResolvedValue([
            makeClaim({ reward_id: "r-claimed", status: "CLAIMED", claimed_at: "2026-01-02T00:00:00Z" }),
            makeClaim({ reward_id: "r-available-claim", status: "AVAILABLE", unlocked_at: "2026-01-01T00:00:00Z" }),
        ]);

        const res = await rewardsStateHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { student_id: "stu-1" },
            })
        );

        expect(res.statusCode).toBe(200);
        const body = parseBody(res);
        expect(body.student_level).toBe(6);

        const byId = new Map(body.rewards.map((r: any) => [r.reward_id, r]));
        expect(byId.get("r-claimed").state).toBe("CLAIMED");
        expect(byId.get("r-available-claim").state).toBe("AVAILABLE");
        expect(byId.get("r-available-level").state).toBe("AVAILABLE"); // level reached, no claim row
        expect(byId.get("r-locked").state).toBe("LOCKED");
    });

    it("defaults to level 1 when no player state", async () => {
        mockGetPlayerState.mockResolvedValue(null);
        mockListRewardMilestonesByClass.mockResolvedValue([
            makeMilestone({ reward_id: "r-1", unlock_level: 1 }),
        ]);
        mockListStudentRewardClaimsByStudentAndClass.mockResolvedValue([]);

        const res = await rewardsStateHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { student_id: "stu-1" },
            })
        );

        const body = parseBody(res);
        expect(body.student_level).toBe(1);
        expect(body.rewards[0].state).toBe("AVAILABLE"); // level 1 >= unlock_level 1
    });

    it("returns 400 when class_id is missing", async () => {
        const res = await rewardsStateHandler(
            makeEvent({ queryStringParameters: { student_id: "stu-1" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_CLASS_ID");
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await rewardsStateHandler(
            makeEvent({ pathParameters: { class_id: "class-1" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_STUDENT_ID");
    });

    it("returns 500 on repo error", async () => {
        mockGetPlayerState.mockRejectedValue(new Error("boom"));

        const res = await rewardsStateHandler(
            makeEvent({
                pathParameters: { class_id: "class-1" },
                queryStringParameters: { student_id: "stu-1" },
            })
        );
        expect(res.statusCode).toBe(500);
    });
});

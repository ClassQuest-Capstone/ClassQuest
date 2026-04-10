/**
 * Unit tests for playerStates handlers:
 *   - get.ts
 *   - get-leaderboard.ts
 *   - upsert-state.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/playerStates
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock repo
// ---------------------------------------------------------------------------
const mockGetPlayerState    = vi.fn();
const mockListLeaderboard   = vi.fn();
const mockUpsertPlayerState = vi.fn();

vi.mock("../repo.js", () => ({
    getPlayerState:    (...args: any[]) => mockGetPlayerState(...args),
    listLeaderboard:   (...args: any[]) => mockListLeaderboard(...args),
    upsertPlayerState: (...args: any[]) => mockUpsertPlayerState(...args),
}));

// ---------------------------------------------------------------------------
// Module references (dynamic import after mock setup)
// ---------------------------------------------------------------------------
let getHandler:         (typeof import("../get.js"))["handler"];
let getLeaderboard:     (typeof import("../get-leaderboard.js"))["handler"];
let upsertHandler:      (typeof import("../upsert-state.js"))["handler"];

beforeAll(async () => {
    process.env.PLAYER_STATES_TABLE_NAME = "test-player-states";
    getHandler      = (await import("../get.js")).handler;
    getLeaderboard  = (await import("../get-leaderboard.js")).handler;
    upsertHandler   = (await import("../upsert-state.js")).handler;
});

beforeEach(() => {
    mockGetPlayerState.mockReset();
    mockListLeaderboard.mockReset();
    mockUpsertPlayerState.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeState(overrides: Record<string, any> = {}) {
    return {
        class_id:        "class-1",
        student_id:      "student-1",
        current_xp:      100,
        xp_to_next_level: 500,
        total_xp_earned: 100,
        hearts:          3,
        max_hearts:      5,
        gold:            50,
        status:          "ALIVE",
        leaderboard_sort: "0999999900#student-1",
        created_at:      "2024-01-01T00:00:00.000Z",
        updated_at:      "2024-01-02T00:00:00.000Z",
        ...overrides,
    };
}

function validBody(overrides: Record<string, any> = {}) {
    return {
        current_xp:       100,
        xp_to_next_level: 500,
        total_xp_earned:  100,
        hearts:           3,
        max_hearts:       5,
        gold:             50,
        status:           "ALIVE",
        ...overrides,
    };
}

// ===========================================================================
// get.ts
// ===========================================================================
describe("get handler", () => {
    describe("path parameter validation", () => {
        it("returns 400 when class_id is missing", async () => {
            const res = await getHandler({ pathParameters: { student_id: "s-1" } });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain("class_id");
        });

        it("returns 400 when student_id is missing", async () => {
            const res = await getHandler({ pathParameters: { class_id: "c-1" } });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain("student_id");
        });

        it("returns 400 when pathParameters is absent", async () => {
            const res = await getHandler({});
            expect(res.statusCode).toBe(400);
        });
    });

    describe("success path", () => {
        it("returns 200 with the player state item", async () => {
            const state = makeState();
            mockGetPlayerState.mockResolvedValueOnce(state);

            const res = await getHandler({ pathParameters: { class_id: "class-1", student_id: "student-1" } });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body)).toEqual(state);
        });

        it("calls getPlayerState with correct class_id and student_id", async () => {
            mockGetPlayerState.mockResolvedValueOnce(makeState());

            await getHandler({ pathParameters: { class_id: "c-42", student_id: "s-99" } });

            expect(mockGetPlayerState).toHaveBeenCalledWith("c-42", "s-99");
        });
    });

    describe("not found", () => {
        it("returns 404 when getPlayerState returns null", async () => {
            mockGetPlayerState.mockResolvedValueOnce(null);

            const res = await getHandler({ pathParameters: { class_id: "c-1", student_id: "s-1" } });

            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res.body).error).toContain("not found");
        });
    });

    describe("error handling", () => {
        it("returns 500 when getPlayerState throws", async () => {
            mockGetPlayerState.mockRejectedValueOnce(new Error("DDB failure"));

            const res = await getHandler({ pathParameters: { class_id: "c-1", student_id: "s-1" } });

            expect(res.statusCode).toBe(500);
            const body = JSON.parse(res.body);
            expect(body.error).toContain("server error");
            expect(body.message).toContain("DDB failure");
        });
    });
});

// ===========================================================================
// get-leaderboard.ts
// ===========================================================================
describe("get-leaderboard handler", () => {
    describe("path parameter validation", () => {
        it("returns 400 when class_id is missing", async () => {
            const res = await getLeaderboard({ pathParameters: {} });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain("class_id");
        });

        it("returns 400 when pathParameters is absent", async () => {
            const res = await getLeaderboard({});
            expect(res.statusCode).toBe(400);
        });
    });

    describe("limit validation", () => {
        it("returns 400 when limit is not a number", async () => {
            const res = await getLeaderboard({
                pathParameters: { class_id: "c-1" },
                queryStringParameters: { limit: "abc" },
            });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain("limit");
        });

        it("returns 400 when limit is 0", async () => {
            const res = await getLeaderboard({
                pathParameters: { class_id: "c-1" },
                queryStringParameters: { limit: "0" },
            });
            expect(res.statusCode).toBe(400);
        });

        it("returns 400 when limit is negative", async () => {
            const res = await getLeaderboard({
                pathParameters: { class_id: "c-1" },
                queryStringParameters: { limit: "-5" },
            });
            expect(res.statusCode).toBe(400);
        });
    });

    describe("success path", () => {
        it("returns 200 with items and nextCursor", async () => {
            const items = [makeState()];
            mockListLeaderboard.mockResolvedValueOnce({ items, nextCursor: "cursor123" });

            const res = await getLeaderboard({
                pathParameters: { class_id: "c-1" },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.items).toEqual(items);
            expect(body.nextCursor).toBe("cursor123");
            expect(body.hasMore).toBe(true);
        });

        it("sets hasMore to false when nextCursor is absent", async () => {
            mockListLeaderboard.mockResolvedValueOnce({ items: [], nextCursor: undefined });

            const res = await getLeaderboard({ pathParameters: { class_id: "c-1" } });

            const body = JSON.parse(res.body);
            expect(body.hasMore).toBe(false);
            expect(body.nextCursor).toBeUndefined();
        });

        it("passes default limit 50 when limit not provided", async () => {
            mockListLeaderboard.mockResolvedValueOnce({ items: [] });

            await getLeaderboard({ pathParameters: { class_id: "c-1" } });

            expect(mockListLeaderboard).toHaveBeenCalledWith("c-1", 50, undefined);
        });

        it("passes parsed limit to listLeaderboard", async () => {
            mockListLeaderboard.mockResolvedValueOnce({ items: [] });

            await getLeaderboard({
                pathParameters: { class_id: "c-1" },
                queryStringParameters: { limit: "25" },
            });

            expect(mockListLeaderboard).toHaveBeenCalledWith("c-1", 25, undefined);
        });

        it("passes cursor query param to listLeaderboard", async () => {
            mockListLeaderboard.mockResolvedValueOnce({ items: [] });

            await getLeaderboard({
                pathParameters: { class_id: "c-1" },
                queryStringParameters: { cursor: "abc123" },
            });

            expect(mockListLeaderboard).toHaveBeenCalledWith("c-1", 50, "abc123");
        });
    });

    describe("error handling", () => {
        it("returns 400 when repo throws 'Invalid cursor format'", async () => {
            mockListLeaderboard.mockRejectedValueOnce(new Error("Invalid cursor format"));

            const res = await getLeaderboard({ pathParameters: { class_id: "c-1" } });

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain("cursor");
        });

        it("returns 500 for other errors", async () => {
            mockListLeaderboard.mockRejectedValueOnce(new Error("Unexpected failure"));

            const res = await getLeaderboard({ pathParameters: { class_id: "c-1" } });

            expect(res.statusCode).toBe(500);
            const body = JSON.parse(res.body);
            expect(body.message).toContain("Unexpected failure");
        });
    });
});

// ===========================================================================
// upsert-state.ts
// ===========================================================================
describe("upsert-state handler", () => {
    describe("path parameter validation", () => {
        it("returns 400 when class_id is missing", async () => {
            const res = await upsertHandler({
                pathParameters: { student_id: "s-1" },
                body: JSON.stringify(validBody()),
            });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain("class_id");
        });

        it("returns 400 when student_id is missing", async () => {
            const res = await upsertHandler({
                pathParameters: { class_id: "c-1" },
                body: JSON.stringify(validBody()),
            });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toContain("student_id");
        });
    });

    describe("validation", () => {
        it("returns 400 when validation fails (missing required field)", async () => {
            const body = validBody({ current_xp: undefined });

            const res = await upsertHandler({
                pathParameters: { class_id: "c-1", student_id: "s-1" },
                body: JSON.stringify(body),
            });

            expect(res.statusCode).toBe(400);
            const parsed = JSON.parse(res.body);
            expect(parsed.error).toBe("Validation failed");
            expect(Array.isArray(parsed.details)).toBe(true);
        });

        it("returns 400 when hearts exceeds max_hearts", async () => {
            const body = validBody({ hearts: 10, max_hearts: 5 });

            const res = await upsertHandler({
                pathParameters: { class_id: "c-1", student_id: "s-1" },
                body: JSON.stringify(body),
            });

            expect(res.statusCode).toBe(400);
        });
    });

    describe("success path", () => {
        it("returns 200 with ok, class_id, student_id on success", async () => {
            mockUpsertPlayerState.mockResolvedValueOnce(undefined);

            const res = await upsertHandler({
                pathParameters: { class_id: "c-1", student_id: "s-1" },
                body: JSON.stringify(validBody()),
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.ok).toBe(true);
            expect(body.class_id).toBe("c-1");
            expect(body.student_id).toBe("s-1");
        });

        it("calls upsertPlayerState with correct class_id and student_id from path", async () => {
            mockUpsertPlayerState.mockResolvedValueOnce(undefined);

            await upsertHandler({
                pathParameters: { class_id: "c-99", student_id: "s-77" },
                body: JSON.stringify(validBody()),
            });

            expect(mockUpsertPlayerState).toHaveBeenCalledWith(
                expect.objectContaining({ class_id: "c-99", student_id: "s-77" })
            );
        });

        it("passes all required body fields to upsertPlayerState", async () => {
            mockUpsertPlayerState.mockResolvedValueOnce(undefined);
            const data = validBody({ current_xp: 42, gold: 99, status: "DOWNED" });

            await upsertHandler({
                pathParameters: { class_id: "c-1", student_id: "s-1" },
                body: JSON.stringify(data),
            });

            expect(mockUpsertPlayerState).toHaveBeenCalledWith(
                expect.objectContaining({ current_xp: 42, gold: 99, status: "DOWNED" })
            );
        });

        it("parses JSON string body correctly", async () => {
            mockUpsertPlayerState.mockResolvedValueOnce(undefined);

            const res = await upsertHandler({
                pathParameters: { class_id: "c-1", student_id: "s-1" },
                body: JSON.stringify(validBody()),
            });

            expect(res.statusCode).toBe(200);
        });

        it("handles body as already-parsed object", async () => {
            mockUpsertPlayerState.mockResolvedValueOnce(undefined);

            const res = await upsertHandler({
                pathParameters: { class_id: "c-1", student_id: "s-1" },
                body: validBody(),
            });

            expect(res.statusCode).toBe(200);
        });

        it("passes optional fields to upsertPlayerState when provided", async () => {
            mockUpsertPlayerState.mockResolvedValueOnce(undefined);
            const data = validBody({
                heart_regen_interval_hours: 4,
                heart_regen_enabled: false,
                last_weekend_reset_at: "2024-01-01T00:00:00.000Z",
            });

            await upsertHandler({
                pathParameters: { class_id: "c-1", student_id: "s-1" },
                body: JSON.stringify(data),
            });

            expect(mockUpsertPlayerState).toHaveBeenCalledWith(
                expect.objectContaining({
                    heart_regen_interval_hours: 4,
                    heart_regen_enabled: false,
                    last_weekend_reset_at: "2024-01-01T00:00:00.000Z",
                })
            );
        });
    });

    describe("error handling", () => {
        it("returns 500 when upsertPlayerState throws", async () => {
            mockUpsertPlayerState.mockRejectedValueOnce(new Error("DDB write error"));

            const res = await upsertHandler({
                pathParameters: { class_id: "c-1", student_id: "s-1" },
                body: JSON.stringify(validBody()),
            });

            expect(res.statusCode).toBe(500);
            const body = JSON.parse(res.body);
            expect(body.message).toContain("DDB write error");
        });
    });
});

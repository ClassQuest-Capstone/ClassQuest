/**
 * Unit tests for questInstances HTTP handlers:
 *   - create.ts
 *   - get.ts
 *   - list-by-class.ts
 *   - list-by-template.ts
 *   - update-dates.ts
 *   - update-status.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/questInstances
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock repo
// ---------------------------------------------------------------------------
const mockCreateInstance  = vi.fn();
const mockGetInstance     = vi.fn();
const mockListByClass     = vi.fn();
const mockListByTemplate  = vi.fn();
const mockUpdateStatus    = vi.fn();
const mockUpdateDates     = vi.fn();

vi.mock("../repo.ts", () => ({
    createInstance:     (...args: any[]) => mockCreateInstance(...args),
    getInstance:        (...args: any[]) => mockGetInstance(...args),
    listByClass:        (...args: any[]) => mockListByClass(...args),
    listByTemplate:     (...args: any[]) => mockListByTemplate(...args),
    updateStatus:       (...args: any[]) => mockUpdateStatus(...args),
    updateDates:        (...args: any[]) => mockUpdateDates(...args),
    // computeScheduleKeys is used by create.ts — provide real-ish implementation
    computeScheduleKeys: (status: string, id: string, start_date?: string | null) => {
        if (status === "SCHEDULED" && start_date) {
            return { schedule_pk: "SCHEDULED", schedule_sk: `${start_date}#${id}` };
        }
        return {};
    },
}));

// ---------------------------------------------------------------------------
// Handler references
// ---------------------------------------------------------------------------
let createHandler:          (typeof import("../create.js"))["handler"];
let getHandler:             (typeof import("../get.js"))["handler"];
let listByClassHandler:     (typeof import("../list-by-class.js"))["handler"];
let listByTemplateHandler:  (typeof import("../list-by-template.js"))["handler"];
let updateDatesHandler:     (typeof import("../update-dates.js"))["handler"];
let updateStatusHandler:    (typeof import("../update-status.js"))["handler"];

beforeAll(async () => {
    process.env.QUEST_INSTANCES_TABLE_NAME = "test-quest-instances";
    createHandler         = (await import("../create.js")).handler;
    getHandler            = (await import("../get.js")).handler;
    listByClassHandler    = (await import("../list-by-class.js")).handler;
    listByTemplateHandler = (await import("../list-by-template.js")).handler;
    updateDatesHandler    = (await import("../update-dates.js")).handler;
    updateStatusHandler   = (await import("../update-status.js")).handler;
});

beforeEach(() => {
    mockCreateInstance.mockReset();
    mockGetInstance.mockReset();
    mockListByClass.mockReset();
    mockListByTemplate.mockReset();
    mockUpdateStatus.mockReset();
    mockUpdateDates.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeItem(overrides: Record<string, any> = {}) {
    return {
        quest_instance_id: "qi-1",
        class_id: "class-1",
        status: "DRAFT",
        requires_manual_approval: false,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
        ...overrides,
    };
}

function conditionalError() {
    return Object.assign(new Error("Condition failed"), { name: "ConditionalCheckFailedException" });
}

// ===========================================================================
// create.ts
// ===========================================================================
describe("create handler", () => {
    function makeEvent(pathOverrides: Record<string, any> = {}, bodyOverrides: Record<string, any> = {}) {
        return {
            pathParameters: { class_id: "class-1", ...pathOverrides },
            body: JSON.stringify({ requires_manual_approval: false, ...bodyOverrides }),
        };
    }

    describe("path parameter validation", () => {
        it("returns 400 MISSING_CLASS_ID when class_id is absent", async () => {
            const res = await createHandler({ pathParameters: {} });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("MISSING_CLASS_ID");
        });
    });

    describe("body validation", () => {
        it("returns 400 when requires_manual_approval is missing", async () => {
            const res = await createHandler(makeEvent({}, { requires_manual_approval: undefined }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("MISSING_REQUIRED_FIELD");
        });

        it("returns 400 when requires_manual_approval is not a boolean", async () => {
            const res = await createHandler(makeEvent({}, { requires_manual_approval: "yes" }));
            expect(res.statusCode).toBe(400);
        });

        it("returns 400 INVALID_STATUS for unknown status", async () => {
            const res = await createHandler(makeEvent({}, { status: "UNKNOWN" }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("INVALID_STATUS");
        });

        it("returns 400 INVALID_START_DATE for non-date start_date", async () => {
            const res = await createHandler(makeEvent({}, { start_date: "not-a-date" }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("INVALID_START_DATE");
        });

        it("returns 400 INVALID_DUE_DATE for non-date due_date", async () => {
            const res = await createHandler(makeEvent({}, { due_date: "not-a-date" }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("INVALID_DUE_DATE");
        });

        it("returns 400 INVALID_DATE_RANGE when due_date < start_date", async () => {
            const res = await createHandler(makeEvent({}, {
                start_date: "2024-06-10",
                due_date: "2024-06-01",
            }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("INVALID_DATE_RANGE");
        });
    });

    describe("success", () => {
        it("returns 201 with quest_instance_id on success", async () => {
            mockCreateInstance.mockResolvedValueOnce(undefined);
            const res = await createHandler(makeEvent());
            expect(res.statusCode).toBe(201);
            const body = JSON.parse(res.body);
            expect(body.quest_instance_id).toBeTruthy();
            expect(body.message).toContain("created");
        });

        it("defaults status to DRAFT when not provided", async () => {
            mockCreateInstance.mockResolvedValueOnce(undefined);
            await createHandler(makeEvent());
            const item = mockCreateInstance.mock.calls[0][0];
            expect(item.status).toBe("DRAFT");
        });

        it("passes class_id from path to createInstance", async () => {
            mockCreateInstance.mockResolvedValueOnce(undefined);
            await createHandler(makeEvent({ class_id: "cls-99" }));
            const item = mockCreateInstance.mock.calls[0][0];
            expect(item.class_id).toBe("cls-99");
        });

        it("populates schedule keys when status is SCHEDULED with start_date", async () => {
            mockCreateInstance.mockResolvedValueOnce(undefined);
            await createHandler(makeEvent({}, { status: "SCHEDULED", start_date: "2024-06-01" }));
            const item = mockCreateInstance.mock.calls[0][0];
            expect(item.schedule_pk).toBe("SCHEDULED");
            expect(item.schedule_sk).toContain("2024-06-01");
        });

        it("does not populate schedule keys for DRAFT status", async () => {
            mockCreateInstance.mockResolvedValueOnce(undefined);
            await createHandler(makeEvent());
            const item = mockCreateInstance.mock.calls[0][0];
            expect(item.schedule_pk).toBeUndefined();
        });

        it("parses body when provided as JSON string", async () => {
            mockCreateInstance.mockResolvedValueOnce(undefined);
            const res = await createHandler({
                pathParameters: { class_id: "class-1" },
                body: JSON.stringify({ requires_manual_approval: true }),
            });
            expect(res.statusCode).toBe(201);
        });
    });

    describe("error handling", () => {
        it("returns 409 on ConditionalCheckFailedException", async () => {
            mockCreateInstance.mockRejectedValueOnce(conditionalError());
            const res = await createHandler(makeEvent());
            expect(res.statusCode).toBe(409);
            expect(JSON.parse(res.body).error).toBe("QUEST_INSTANCE_ALREADY_EXISTS");
        });

        it("returns 500 on unexpected error", async () => {
            mockCreateInstance.mockRejectedValueOnce(new Error("DDB failure"));
            const res = await createHandler(makeEvent());
            expect(res.statusCode).toBe(500);
            expect(JSON.parse(res.body).error).toBe("INTERNAL_SERVER_ERROR");
        });
    });
});

// ===========================================================================
// get.ts
// ===========================================================================
describe("get handler", () => {
    function makeEvent(id = "qi-1") {
        return { pathParameters: { quest_instance_id: id } };
    }

    describe("path parameter validation", () => {
        it("returns 400 MISSING_QUEST_INSTANCE_ID when id is absent", async () => {
            const res = await getHandler({ pathParameters: {} });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("MISSING_QUEST_INSTANCE_ID");
        });
    });

    describe("success", () => {
        it("returns 200 with the item", async () => {
            const item = makeItem();
            mockGetInstance.mockResolvedValueOnce(item);
            const res = await getHandler(makeEvent());
            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body)).toEqual(item);
        });

        it("calls getInstance with the correct id", async () => {
            mockGetInstance.mockResolvedValueOnce(makeItem());
            await getHandler(makeEvent("qi-42"));
            expect(mockGetInstance).toHaveBeenCalledWith("qi-42");
        });
    });

    describe("not found", () => {
        it("returns 404 when getInstance returns null", async () => {
            mockGetInstance.mockResolvedValueOnce(null);
            const res = await getHandler(makeEvent());
            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res.body).error).toBe("QUEST_INSTANCE_NOT_FOUND");
        });
    });

    describe("error handling", () => {
        it("returns 500 on unexpected error", async () => {
            mockGetInstance.mockRejectedValueOnce(new Error("DDB failure"));
            const res = await getHandler(makeEvent());
            expect(res.statusCode).toBe(500);
            expect(JSON.parse(res.body).error).toBe("INTERNAL_SERVER_ERROR");
        });
    });
});

// ===========================================================================
// list-by-class.ts
// ===========================================================================
describe("list-by-class handler", () => {
    function makeEvent(class_id = "class-1") {
        return { pathParameters: { class_id } };
    }

    describe("path parameter validation", () => {
        it("returns 400 MISSING_CLASS_ID when class_id is absent", async () => {
            const res = await listByClassHandler({ pathParameters: {} });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("MISSING_CLASS_ID");
        });
    });

    describe("success", () => {
        it("returns 200 with items and count", async () => {
            const items = [makeItem(), makeItem({ quest_instance_id: "qi-2" })];
            mockListByClass.mockResolvedValueOnce(items);
            const res = await listByClassHandler(makeEvent());
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.items).toEqual(items);
            expect(body.count).toBe(2);
        });

        it("returns empty list when no instances found", async () => {
            mockListByClass.mockResolvedValueOnce([]);
            const res = await listByClassHandler(makeEvent());
            const body = JSON.parse(res.body);
            expect(body.items).toEqual([]);
            expect(body.count).toBe(0);
        });

        it("calls listByClass with the correct class_id", async () => {
            mockListByClass.mockResolvedValueOnce([]);
            await listByClassHandler(makeEvent("cls-99"));
            expect(mockListByClass).toHaveBeenCalledWith("cls-99");
        });
    });

    describe("error handling", () => {
        it("returns 500 on unexpected error", async () => {
            mockListByClass.mockRejectedValueOnce(new Error("DDB failure"));
            const res = await listByClassHandler(makeEvent());
            expect(res.statusCode).toBe(500);
            expect(JSON.parse(res.body).error).toBe("INTERNAL_SERVER_ERROR");
        });
    });
});

// ===========================================================================
// list-by-template.ts
// ===========================================================================
describe("list-by-template handler", () => {
    function makeEvent(quest_template_id = "tmpl-1") {
        return { pathParameters: { quest_template_id } };
    }

    describe("path parameter validation", () => {
        it("returns 400 MISSING_QUEST_TEMPLATE_ID when id is absent", async () => {
            const res = await listByTemplateHandler({ pathParameters: {} });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("MISSING_QUEST_TEMPLATE_ID");
        });
    });

    describe("success", () => {
        it("returns 200 with items and count", async () => {
            const items = [makeItem()];
            mockListByTemplate.mockResolvedValueOnce(items);
            const res = await listByTemplateHandler(makeEvent());
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.items).toEqual(items);
            expect(body.count).toBe(1);
        });

        it("returns empty list when no instances found", async () => {
            mockListByTemplate.mockResolvedValueOnce([]);
            const res = await listByTemplateHandler(makeEvent());
            const body = JSON.parse(res.body);
            expect(body.items).toEqual([]);
            expect(body.count).toBe(0);
        });

        it("calls listByTemplate with the correct template_id", async () => {
            mockListByTemplate.mockResolvedValueOnce([]);
            await listByTemplateHandler(makeEvent("tmpl-xyz"));
            expect(mockListByTemplate).toHaveBeenCalledWith("tmpl-xyz");
        });
    });

    describe("error handling", () => {
        it("returns 500 on unexpected error", async () => {
            mockListByTemplate.mockRejectedValueOnce(new Error("DDB failure"));
            const res = await listByTemplateHandler(makeEvent());
            expect(res.statusCode).toBe(500);
            expect(JSON.parse(res.body).error).toBe("INTERNAL_SERVER_ERROR");
        });
    });
});

// ===========================================================================
// update-dates.ts
// ===========================================================================
describe("update-dates handler", () => {
    function makeEvent(id = "qi-1", bodyOverrides: Record<string, any> = {}) {
        return {
            pathParameters: { quest_instance_id: id },
            body: JSON.stringify({ start_date: "2024-06-01", ...bodyOverrides }),
        };
    }

    describe("path parameter validation", () => {
        it("returns 400 MISSING_QUEST_INSTANCE_ID when id is absent", async () => {
            const res = await updateDatesHandler({ pathParameters: {}, body: JSON.stringify({ start_date: "2024-06-01" }) });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("MISSING_QUEST_INSTANCE_ID");
        });
    });

    describe("body validation", () => {
        it("returns 400 NO_DATES_PROVIDED when neither date is in the body", async () => {
            const res = await updateDatesHandler({
                pathParameters: { quest_instance_id: "qi-1" },
                body: JSON.stringify({}),
            });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("NO_DATES_PROVIDED");
        });

        it("returns 400 INVALID_START_DATE for a non-date string", async () => {
            const res = await updateDatesHandler(makeEvent("qi-1", { start_date: "not-a-date" }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("INVALID_START_DATE");
        });

        it("returns 400 INVALID_DUE_DATE for a non-date due_date string", async () => {
            const res = await updateDatesHandler(makeEvent("qi-1", { start_date: undefined, due_date: "bad-date" }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("INVALID_DUE_DATE");
        });

        it("returns 400 INVALID_DATE_RANGE when due_date < start_date", async () => {
            const res = await updateDatesHandler(makeEvent("qi-1", { start_date: "2024-06-10", due_date: "2024-06-01" }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("INVALID_DATE_RANGE");
        });

        it("accepts null start_date to remove it", async () => {
            mockUpdateDates.mockResolvedValueOnce(undefined);
            const res = await updateDatesHandler(makeEvent("qi-1", { start_date: null }));
            expect(res.statusCode).toBe(200);
        });

        it("accepts null due_date to remove it", async () => {
            mockUpdateDates.mockResolvedValueOnce(undefined);
            const res = await updateDatesHandler(makeEvent("qi-1", { start_date: undefined, due_date: null }));
            expect(res.statusCode).toBe(200);
        });
    });

    describe("success", () => {
        it("returns 200 with quest_instance_id on success", async () => {
            mockUpdateDates.mockResolvedValueOnce(undefined);
            const res = await updateDatesHandler(makeEvent());
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.quest_instance_id).toBe("qi-1");
            expect(body.message).toContain("updated");
        });

        it("calls updateDates with the correct id and dates", async () => {
            mockUpdateDates.mockResolvedValueOnce(undefined);
            await updateDatesHandler(makeEvent("qi-42", { start_date: "2024-06-01", due_date: "2024-07-01" }));
            expect(mockUpdateDates).toHaveBeenCalledWith("qi-42", "2024-06-01", "2024-07-01");
        });
    });

    describe("error handling", () => {
        it("returns 404 on ConditionalCheckFailedException", async () => {
            mockUpdateDates.mockRejectedValueOnce(conditionalError());
            const res = await updateDatesHandler(makeEvent());
            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res.body).error).toBe("QUEST_INSTANCE_NOT_FOUND");
        });

        it("returns 500 on unexpected error", async () => {
            mockUpdateDates.mockRejectedValueOnce(new Error("DDB failure"));
            const res = await updateDatesHandler(makeEvent());
            expect(res.statusCode).toBe(500);
            expect(JSON.parse(res.body).error).toBe("INTERNAL_SERVER_ERROR");
        });
    });
});

// ===========================================================================
// update-status.ts
// ===========================================================================
describe("update-status handler", () => {
    function makeEvent(id = "qi-1", bodyOverrides: Record<string, any> = {}) {
        return {
            pathParameters: { quest_instance_id: id },
            body: JSON.stringify({ status: "ACTIVE", ...bodyOverrides }),
        };
    }

    describe("path parameter validation", () => {
        it("returns 400 MISSING_QUEST_INSTANCE_ID when id is absent", async () => {
            const res = await updateStatusHandler({ pathParameters: {}, body: JSON.stringify({ status: "ACTIVE" }) });
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("MISSING_QUEST_INSTANCE_ID");
        });
    });

    describe("body validation", () => {
        it("returns 400 INVALID_STATUS when status is missing", async () => {
            const res = await updateStatusHandler(makeEvent("qi-1", { status: undefined }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("INVALID_STATUS");
        });

        it("returns 400 INVALID_STATUS for unknown status", async () => {
            const res = await updateStatusHandler(makeEvent("qi-1", { status: "PUBLISHED" }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("INVALID_STATUS");
        });

        it("returns 400 MISSING_START_DATE when setting SCHEDULED without start_date", async () => {
            const res = await updateStatusHandler(makeEvent("qi-1", { status: "SCHEDULED" }));
            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res.body).error).toBe("MISSING_START_DATE");
        });
    });

    describe("success", () => {
        it("returns 200 with quest_instance_id and status on success", async () => {
            mockUpdateStatus.mockResolvedValueOnce(undefined);
            const res = await updateStatusHandler(makeEvent());
            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.quest_instance_id).toBe("qi-1");
            expect(body.status).toBe("ACTIVE");
            expect(body.message).toContain("updated");
        });

        it("calls updateStatus with the correct id and status", async () => {
            mockUpdateStatus.mockResolvedValueOnce(undefined);
            await updateStatusHandler(makeEvent("qi-99", { status: "ARCHIVED" }));
            expect(mockUpdateStatus).toHaveBeenCalledWith("qi-99", "ARCHIVED", null);
        });

        it("allows all valid statuses (DRAFT, SCHEDULED with start_date, ACTIVE, ARCHIVED)", async () => {
            for (const status of ["DRAFT", "ACTIVE", "ARCHIVED"]) {
                mockUpdateStatus.mockResolvedValueOnce(undefined);
                const res = await updateStatusHandler(makeEvent("qi-1", { status }));
                expect(res.statusCode).toBe(200);
            }
        });

        it("allows SCHEDULED when start_date is provided", async () => {
            mockUpdateStatus.mockResolvedValueOnce(undefined);
            const res = await updateStatusHandler(makeEvent("qi-1", { status: "SCHEDULED", start_date: "2024-06-01" }));
            expect(res.statusCode).toBe(200);
        });
    });

    describe("error handling", () => {
        it("returns 404 on ConditionalCheckFailedException", async () => {
            mockUpdateStatus.mockRejectedValueOnce(conditionalError());
            const res = await updateStatusHandler(makeEvent());
            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res.body).error).toBe("QUEST_INSTANCE_NOT_FOUND");
        });

        it("returns 500 on unexpected error", async () => {
            mockUpdateStatus.mockRejectedValueOnce(new Error("DDB failure"));
            const res = await updateStatusHandler(makeEvent());
            expect(res.statusCode).toBe(500);
            expect(JSON.parse(res.body).error).toBe("INTERNAL_SERVER_ERROR");
        });
    });
});

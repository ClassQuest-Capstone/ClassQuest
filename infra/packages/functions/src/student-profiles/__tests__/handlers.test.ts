import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Local repo mock                                                    */
/* ------------------------------------------------------------------ */
const mockPutStudentProfile          = vi.fn();
const mockGetStudentProfile          = vi.fn();
const mockUpdateStudentProfile       = vi.fn();
const mockGetStudentProfileByUsername = vi.fn();
const mockListStudentsBySchool       = vi.fn();

const repoExports = {
    putStudentProfile:          (...args: any[]) => mockPutStudentProfile(...args),
    getStudentProfile:          (...args: any[]) => mockGetStudentProfile(...args),
    updateStudentProfile:       (...args: any[]) => mockUpdateStudentProfile(...args),
    getStudentProfileByUsername: (...args: any[]) => mockGetStudentProfileByUsername(...args),
    listStudentsBySchool:       (...args: any[]) => mockListStudentsBySchool(...args),
};

vi.mock("../repo",    () => repoExports);
vi.mock("../repo.ts", () => repoExports);
vi.mock("../repo.js", () => repoExports);

/* ------------------------------------------------------------------ */
/*  Teacher-profiles repo mock                                         */
/* ------------------------------------------------------------------ */
const mockGetTeacherProfile = vi.fn();

const teacherRepoExports = {
    getTeacherProfile: (...args: any[]) => mockGetTeacherProfile(...args),
};

vi.mock("../../teacher-profiles/repo.ts", () => teacherRepoExports);
vi.mock("../../teacher-profiles/repo.js", () => teacherRepoExports);

/* ------------------------------------------------------------------ */
/*  Auth mock (with real AuthError class for instanceof checks)        */
/* ------------------------------------------------------------------ */
const mockGetAuthContext  = vi.fn();
const mockRequireTeacher  = vi.fn();
const mockGetClientIp     = vi.fn();

const _authMock = (() => {
    class AuthError extends Error {
        statusCode: number;
        constructor(message: string, statusCode: number) {
            super(message);
            this.statusCode = statusCode;
        }
    }
    return {
        getAuthContext:  (...args: any[]) => mockGetAuthContext(...args),
        requireTeacher:  (...args: any[]) => mockRequireTeacher(...args),
        getClientIp:     (...args: any[]) => mockGetClientIp(...args),
        AuthError,
    };
})();

vi.mock("../../shared/auth.ts", () => _authMock);
vi.mock("../../shared/auth.js", () => _authMock);

const AuthError = _authMock.AuthError;

/* ------------------------------------------------------------------ */
/*  Cognito mock                                                       */
/* ------------------------------------------------------------------ */
const mockCognitoSend = vi.fn();

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
    CognitoIdentityProviderClient: vi.fn(function () { return { send: mockCognitoSend }; }),
    AdminSetUserPasswordCommand:     vi.fn(function (input: any) { return { input }; }),
    AdminCreateUserCommand:          vi.fn(function (input: any) { return { input }; }),
    AdminAddUserToGroupCommand:      vi.fn(function (input: any) { return { input }; }),
    AdminUpdateUserAttributesCommand: vi.fn(function (input: any) { return { input }; }),
}));

/* ------------------------------------------------------------------ */
/*  Handler imports (dynamic)                                          */
/* ------------------------------------------------------------------ */
let createHandler:      (typeof import("../create.ts"))["handler"];
let getHandler:         (typeof import("../get.ts"))["handler"];
let listBySchoolHandler:(typeof import("../list-by-school.ts"))["handler"];
let setPasswordHandler: (typeof import("../set-password.ts"))["handler"];
let updateHandler:      (typeof import("../update.ts"))["handler"];
let createStudentProfileHandler: (typeof import("../handlers.ts"))["createStudentProfileHandler"];

beforeAll(async () => {
    process.env.USER_POOL_ID = "test-pool";
    createHandler      = (await import("../create.ts")).handler;
    getHandler         = (await import("../get.ts")).handler;
    listBySchoolHandler = (await import("../list-by-school.ts")).handler;
    setPasswordHandler = (await import("../set-password.ts")).handler;
    updateHandler      = (await import("../update.ts")).handler;
    createStudentProfileHandler = (await import("../handlers.ts")).createStudentProfileHandler;
});

beforeEach(() => {
    mockPutStudentProfile.mockReset();
    mockGetStudentProfile.mockReset();
    mockUpdateStudentProfile.mockReset();
    mockGetStudentProfileByUsername.mockReset();
    mockListStudentsBySchool.mockReset();
    mockGetTeacherProfile.mockReset();
    mockGetAuthContext.mockReset();
    mockRequireTeacher.mockReset();
    mockGetClientIp.mockReset();
    mockCognitoSend.mockReset();

    // Defaults
    mockGetAuthContext.mockResolvedValue({ sub: "teacher-1", role: "teacher" });
    mockRequireTeacher.mockImplementation(() => {}); // no-op
    mockGetClientIp.mockReturnValue("127.0.0.1");
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function makeEvent(overrides: {
    body?: object | string;
    pathParameters?: Record<string, string>;
} = {}) {
    return {
        body: overrides.body
            ? typeof overrides.body === "string"
                ? overrides.body
                : JSON.stringify(overrides.body)
            : undefined,
        pathParameters: overrides.pathParameters,
        headers: {},
    };
}

function parseBody(res: any) {
    return JSON.parse(res.body);
}

function makeProfile(overrides: Record<string, any> = {}) {
    return {
        student_id: "stu-1",
        school_id: "school-1",
        display_name: "Alice",
        username: "alice_01",
        grade: "6",
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
        student_id: "stu-1",
        school_id: "school-1",
        display_name: "Alice",
        username: "alice_01",
    };

    it("returns 201 on success", async () => {
        mockPutStudentProfile.mockResolvedValue(undefined);

        const res = await createHandler(makeEvent({ body: validBody }));

        expect(res.statusCode).toBe(201);
        expect(parseBody(res).ok).toBe(true);
        expect(parseBody(res).student_id).toBe("stu-1");
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { school_id: "s", display_name: "A", username: "a" } })
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("MISSING_REQUIRED_FIELDS");
    });

    it("returns 400 when school_id is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { student_id: "s", display_name: "A", username: "a" } })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when display_name is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { student_id: "s", school_id: "s", username: "a" } })
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 when username is missing", async () => {
        const res = await createHandler(
            makeEvent({ body: { student_id: "s", school_id: "s", display_name: "A" } })
        );
        expect(res.statusCode).toBe(400);
    });

    it("throws on repo error", async () => {
        mockPutStudentProfile.mockRejectedValue(new Error("boom"));
        await expect(createHandler(makeEvent({ body: validBody }))).rejects.toThrow("boom");
    });
});

/* ================================================================== */
/*  get handler                                                        */
/* ================================================================== */
describe("get handler", () => {
    it("returns 200 with profile when found", async () => {
        const profile = makeProfile();
        mockGetStudentProfile.mockResolvedValue(profile);

        const res = await getHandler(
            makeEvent({ pathParameters: { student_id: "stu-1" } })
        );
        expect(res.statusCode).toBe(200);
        expect(parseBody(res)).toEqual(profile);
    });

    it("returns 404 when not found", async () => {
        mockGetStudentProfile.mockResolvedValue(null);

        const res = await getHandler(
            makeEvent({ pathParameters: { student_id: "missing" } })
        );
        expect(res.statusCode).toBe(404);
        expect(parseBody(res).error).toBe("NOT_FOUND");
    });

    it("throws on repo error", async () => {
        mockGetStudentProfile.mockRejectedValue(new Error("boom"));
        await expect(
            getHandler(makeEvent({ pathParameters: { student_id: "stu-1" } }))
        ).rejects.toThrow("boom");
    });
});

/* ================================================================== */
/*  list-by-school handler                                             */
/* ================================================================== */
describe("list-by-school handler", () => {
    it("returns 200 with items", async () => {
        const items = [makeProfile()];
        mockListStudentsBySchool.mockResolvedValue(items);

        const res = await listBySchoolHandler(
            makeEvent({ pathParameters: { school_id: "school-1" } })
        );
        expect(res.statusCode).toBe(200);
        expect(parseBody(res).items).toEqual(items);
    });

    it("returns 200 with empty array", async () => {
        mockListStudentsBySchool.mockResolvedValue([]);

        const res = await listBySchoolHandler(
            makeEvent({ pathParameters: { school_id: "school-1" } })
        );
        expect(parseBody(res).items).toEqual([]);
    });

    it("throws on repo error", async () => {
        mockListStudentsBySchool.mockRejectedValue(new Error("boom"));
        await expect(
            listBySchoolHandler(makeEvent({ pathParameters: { school_id: "school-1" } }))
        ).rejects.toThrow("boom");
    });
});

/* ================================================================== */
/*  handlers.ts — createStudentProfileHandler                          */
/* ================================================================== */
describe("createStudentProfileHandler", () => {
    it("calls putStudentProfile and returns ok", async () => {
        mockPutStudentProfile.mockResolvedValue(undefined);

        const result = await createStudentProfileHandler({
            student_id: "stu-1",
            school_id: "school-1",
            display_name: "Alice",
            username: "alice_01",
            grade: "6",
        });

        expect(result).toEqual({ ok: true, student_id: "stu-1" });
        expect(mockPutStudentProfile).toHaveBeenCalledOnce();
    });

    it("propagates repo errors", async () => {
        mockPutStudentProfile.mockRejectedValue(new Error("boom"));
        await expect(
            createStudentProfileHandler({ student_id: "stu-1" })
        ).rejects.toThrow("boom");
    });
});

/* ================================================================== */
/*  set-password handler                                               */
/* ================================================================== */
describe("set-password handler", () => {
    it("returns 204 when setting password for existing Cognito user", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "school-1" });
        mockCognitoSend.mockResolvedValue({});

        const res = await setPasswordHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { password: "Str0ng!" },
            }) as any
        );

        expect(res.statusCode).toBe(204);
        expect(mockCognitoSend).toHaveBeenCalledOnce();
    });

    it("creates Cognito user when UserNotFoundException on first attempt", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "school-1" });

        const userNotFound = new Error("User not found");
        userNotFound.name = "UserNotFoundException";
        mockCognitoSend
            .mockRejectedValueOnce(userNotFound)  // AdminSetUserPassword fails
            .mockResolvedValueOnce({})             // AdminCreateUser
            .mockResolvedValueOnce({})             // AdminAddUserToGroup
            .mockResolvedValueOnce({});            // AdminSetUserPassword retry

        const res = await setPasswordHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { password: "Str0ng!" },
            }) as any
        );

        expect(res.statusCode).toBe(204);
        expect(mockCognitoSend).toHaveBeenCalledTimes(4);
    });

    it("returns auth error when getAuthContext fails", async () => {
        mockGetAuthContext.mockRejectedValue(new AuthError("Unauthorized", 401));

        const res = await setPasswordHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { password: "Str0ng!" },
            }) as any
        );
        expect(res.statusCode).toBe(401);
    });

    it("returns 403 when requireTeacher rejects", async () => {
        mockRequireTeacher.mockImplementation(() => {
            throw new AuthError("Forbidden", 403);
        });

        const res = await setPasswordHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { password: "Str0ng!" },
            }) as any
        );
        expect(res.statusCode).toBe(403);
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await setPasswordHandler(
            makeEvent({ body: { password: "Str0ng!" } }) as any
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 400 for invalid password", async () => {
        const res = await setPasswordHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { password: "ab" },
            }) as any
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("Validation failed");
    });

    it("returns 404 when student not found", async () => {
        mockGetStudentProfile.mockResolvedValue(null);

        const res = await setPasswordHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { password: "Str0ng!" },
            }) as any
        );
        expect(res.statusCode).toBe(404);
    });

    it("returns 403 when teacher profile not found", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue(null);

        const res = await setPasswordHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { password: "Str0ng!" },
            }) as any
        );
        expect(res.statusCode).toBe(403);
    });

    it("returns 403 when teacher is from different school", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "other-school" });

        const res = await setPasswordHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { password: "Str0ng!" },
            }) as any
        );
        expect(res.statusCode).toBe(403);
    });

    it("returns 400 for Cognito InvalidPasswordException", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "school-1" });

        const err = new Error("Password too weak");
        err.name = "InvalidPasswordException";
        mockCognitoSend.mockRejectedValue(err);

        const res = await setPasswordHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { password: "Str0ng!" },
            }) as any
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 500 on unexpected error", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "school-1" });
        mockCognitoSend.mockRejectedValue(new Error("boom"));

        const res = await setPasswordHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { password: "Str0ng!" },
            }) as any
        );
        expect(res.statusCode).toBe(500);
    });
});

/* ================================================================== */
/*  update handler                                                     */
/* ================================================================== */
describe("update handler", () => {
    it("returns 200 when teacher updates display_name", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "school-1" });
        mockUpdateStudentProfile.mockResolvedValue(makeProfile({ display_name: "Bob" }));

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { display_name: "Bob" },
            }) as any
        );

        expect(res.statusCode).toBe(200);
        expect(parseBody(res).ok).toBe(true);
    });

    it("returns 200 when student updates own display_name", async () => {
        mockGetAuthContext.mockResolvedValue({ sub: "stu-1", role: "student" });
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockUpdateStudentProfile.mockResolvedValue(makeProfile({ display_name: "Bob" }));

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { display_name: "Bob" },
            }) as any
        );

        expect(res.statusCode).toBe(200);
    });

    it("returns 200 when teacher updates username (unique)", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "school-1" });
        mockGetStudentProfileByUsername.mockResolvedValue(null); // username not taken
        mockUpdateStudentProfile.mockResolvedValue(makeProfile({ username: "new_user" }));
        mockCognitoSend.mockResolvedValue({}); // Cognito sync

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { username: "new_user" },
            }) as any
        );

        expect(res.statusCode).toBe(200);
    });

    it("returns auth error when getAuthContext fails", async () => {
        mockGetAuthContext.mockRejectedValue(new AuthError("Unauthorized", 401));

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { display_name: "Bob" },
            }) as any
        );
        expect(res.statusCode).toBe(401);
    });

    it("returns 400 when student_id is missing", async () => {
        const res = await updateHandler(
            makeEvent({ body: { display_name: "Bob" } }) as any
        );
        expect(res.statusCode).toBe(400);
    });

    it("returns 404 when student not found", async () => {
        mockGetStudentProfile.mockResolvedValue(null);

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { display_name: "Bob" },
            }) as any
        );
        expect(res.statusCode).toBe(404);
    });

    it("returns 403 when student updates another profile", async () => {
        mockGetAuthContext.mockResolvedValue({ sub: "stu-2", role: "student" });
        mockGetStudentProfile.mockResolvedValue(makeProfile());

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { display_name: "Bob" },
            }) as any
        );
        expect(res.statusCode).toBe(403);
    });

    it("returns 403 when student tries to change username", async () => {
        mockGetAuthContext.mockResolvedValue({ sub: "stu-1", role: "student" });
        mockGetStudentProfile.mockResolvedValue(makeProfile());

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { username: "new_name" },
            }) as any
        );
        expect(res.statusCode).toBe(403);
    });

    it("returns 403 when teacher is from different school", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "other-school" });

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { display_name: "Bob" },
            }) as any
        );
        expect(res.statusCode).toBe(403);
    });

    it("returns 403 when teacher profile not found", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue(null);

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { display_name: "Bob" },
            }) as any
        );
        expect(res.statusCode).toBe(403);
    });

    it("returns 400 when no valid fields provided", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "school-1" });

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: {},
            }) as any
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toContain("No valid fields");
    });

    it("returns 400 for invalid username format", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "school-1" });

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { username: "ab" }, // too short
            }) as any
        );
        expect(res.statusCode).toBe(400);
        expect(parseBody(res).error).toBe("Validation failed");
    });

    it("returns 409 when username is already taken", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "school-1" });
        mockGetStudentProfileByUsername.mockResolvedValue(makeProfile({ student_id: "stu-other" }));

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { username: "taken_user" },
            }) as any
        );
        expect(res.statusCode).toBe(409);
        expect(parseBody(res).error).toContain("already taken");
    });

    it("returns 409 on ConditionalCheckFailedException", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "school-1" });
        const err = new Error("Condition");
        err.name = "ConditionalCheckFailedException";
        mockUpdateStudentProfile.mockRejectedValue(err);

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { display_name: "Bob" },
            }) as any
        );
        expect(res.statusCode).toBe(409);
    });

    it("returns 200 even when Cognito sync fails (non-fatal)", async () => {
        mockGetStudentProfile.mockResolvedValue(makeProfile());
        mockGetTeacherProfile.mockResolvedValue({ school_id: "school-1" });
        mockGetStudentProfileByUsername.mockResolvedValue(null);
        mockUpdateStudentProfile.mockResolvedValue(makeProfile({ username: "new_user" }));
        mockCognitoSend.mockRejectedValue(new Error("Cognito down"));

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { username: "new_user" },
            }) as any
        );
        expect(res.statusCode).toBe(200);
    });

    it("returns 500 on unexpected error", async () => {
        mockGetStudentProfile.mockRejectedValue(new Error("boom"));

        const res = await updateHandler(
            makeEvent({
                pathParameters: { student_id: "stu-1" },
                body: { display_name: "Bob" },
            }) as any
        );
        expect(res.statusCode).toBe(500);
    });
});

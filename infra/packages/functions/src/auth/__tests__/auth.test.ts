/**
 * Unit tests for the auth Lambda handlers.
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock AWS SDK clients — hoisted before any module imports
// ---------------------------------------------------------------------------
const mockCognitoSend = vi.fn();
const mockDdbSend     = vi.fn();

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
    CognitoIdentityProviderClient: vi.fn(function () {
        return { send: mockCognitoSend };
    }),
    AdminAddUserToGroupCommand:   vi.fn(function (input: any) { return { input }; }),
    ForgotPasswordCommand:        vi.fn(function (input: any) { return { input }; }),
    ConfirmForgotPasswordCommand: vi.fn(function (input: any) { return { input }; }),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: vi.fn(function () { return {}; }),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: {
        from: vi.fn(function () { return { send: mockDdbSend }; }),
    },
    PutCommand: vi.fn(function (input: any) { return { input }; }),
}));

// ---------------------------------------------------------------------------
// Module references — loaded after mocks are in place
// ---------------------------------------------------------------------------
let preSignUpHandler:                (typeof import("../preSignUp.ts"))["handler"];
let postConfirmationHandler:         (typeof import("../postConfirmation.ts"))["handler"];
let teacherForgotPasswordHandler:    (typeof import("../teacher-forgot-password.ts"))["handler"];
let teacherConfirmForgotHandler:     (typeof import("../teacher-confirm-forgot-password.ts"))["handler"];

beforeAll(async () => {
    // Env vars used by postConfirmation and the Cognito handlers
    process.env.GROUP_STUDENTS          = "Students";
    process.env.GROUP_TEACHERS          = "Teachers";
    process.env.GROUP_TEACHERS_PENDING  = "TeachersPending";
    process.env.USERS_TABLE_NAME        = "test-users-table";
    process.env.USER_POOL_CLIENT_ID     = "test-client-id";

    preSignUpHandler             = (await import("../preSignUp.ts")).handler;
    postConfirmationHandler      = (await import("../postConfirmation.ts")).handler;
    teacherForgotPasswordHandler = (await import("../teacher-forgot-password.ts")).handler;
    teacherConfirmForgotHandler  = (await import("../teacher-confirm-forgot-password.ts")).handler;
});

beforeEach(() => {
    mockCognitoSend.mockReset();
    mockDdbSend.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePreSignUpEvent(overrides: {
    userName?: string;
    role?: string;
    email?: string;
} = {}) {
    return {
        userName: overrides.userName ?? "student_bob",
        request: {
            userAttributes: {
                "custom:role": overrides.role ?? "STUDENT",
                ...(overrides.email !== undefined ? { email: overrides.email } : {}),
            },
        },
        response: {
            autoConfirmUser: false,
            autoVerifyEmail: false,
        },
    } as any;
}

function makePostConfirmationEvent(overrides: {
    userName?: string;
    sub?: string;
    role?: string;
    userPoolId?: string;
} = {}) {
    return {
        userPoolId: overrides.userPoolId ?? "us-east-1_ABC",
        userName:   overrides.userName ?? "student_bob",
        request: {
            userAttributes: {
                sub: overrides.sub ?? "sub-abc-123",
                "custom:role": overrides.role ?? "STUDENT",
            },
        },
    } as any;
}

function makeHttpEvent(body: Record<string, unknown>) {
    return { body: JSON.stringify(body) } as any;
}

// ---------------------------------------------------------------------------
// preSignUp
// ---------------------------------------------------------------------------
describe("preSignUp handler", () => {
    it("auto-confirms a student and does not verify email", async () => {
        const event = makePreSignUpEvent({ role: "STUDENT", userName: "bob_student" });
        const result = await preSignUpHandler(event);

        expect(result.response.autoConfirmUser).toBe(true);
        expect(result.response.autoVerifyEmail).toBe(false);
    });

    it("does NOT auto-confirm a teacher, requires email", async () => {
        const event = makePreSignUpEvent({
            role: "TEACHER",
            userName: "teacher_jane",
            email: "jane@school.edu",
        });
        const result = await preSignUpHandler(event);

        expect(result.response.autoConfirmUser).toBe(false);
        expect(result.response.autoVerifyEmail).toBe(false);
    });

    it("throws when teacher signup has no email", async () => {
        const event = makePreSignUpEvent({ role: "TEACHER", userName: "teacher_noemail" });
        await expect(preSignUpHandler(event)).rejects.toThrow("email");
    });

    it("throws when username is in email format", async () => {
        const event = makePreSignUpEvent({ role: "STUDENT", userName: "bob@school.com" });
        await expect(preSignUpHandler(event)).rejects.toThrow("email address");
    });

    it("teacher with email-format username is also rejected", async () => {
        const event = makePreSignUpEvent({
            role: "TEACHER",
            userName: "teacher@school.com",
            email: "teacher@school.com",
        });
        await expect(preSignUpHandler(event)).rejects.toThrow("email address");
    });

    it("throws for unknown role", async () => {
        const event = makePreSignUpEvent({ role: "ADMIN", userName: "admin_user" });
        await expect(preSignUpHandler(event)).rejects.toThrow("Invalid role");
    });

    it("throws when role attribute is missing", async () => {
        const event = {
            userName: "no_role_user",
            request: { userAttributes: {} },
            response: { autoConfirmUser: false, autoVerifyEmail: false },
        } as any;
        await expect(preSignUpHandler(event)).rejects.toThrow("Invalid role");
    });

    it("returns the event object", async () => {
        const event = makePreSignUpEvent({ role: "STUDENT" });
        const result = await preSignUpHandler(event);
        expect(result).toBe(event);
    });
});

// ---------------------------------------------------------------------------
// postConfirmation
// ---------------------------------------------------------------------------
describe("postConfirmation handler", () => {
    it("adds a student to the Students group and writes to DynamoDB", async () => {
        mockCognitoSend.mockResolvedValueOnce({});
        mockDdbSend.mockResolvedValueOnce({});

        const event = makePostConfirmationEvent({ role: "STUDENT", sub: "sub-student-1" });
        const result = await postConfirmationHandler(event);

        // Cognito group assignment
        const [cognitoCall] = mockCognitoSend.mock.calls[0];
        expect(cognitoCall.input.GroupName).toBe("Students");
        expect(cognitoCall.input.Username).toBe("student_bob");

        // DynamoDB write
        const [ddbCall] = mockDdbSend.mock.calls[0];
        expect(ddbCall.input.Item.user_id).toBe("sub-student-1");
        expect(ddbCall.input.Item.role).toBe("student");
        expect(ddbCall.input.Item.status).toBe("active");
        expect(ddbCall.input.ConditionExpression).toBe("attribute_not_exists(user_id)");

        expect(result).toBe(event);
    });

    it("adds a teacher to the Teachers group", async () => {
        mockCognitoSend.mockResolvedValueOnce({});
        mockDdbSend.mockResolvedValueOnce({});

        const event = makePostConfirmationEvent({ role: "TEACHER", sub: "sub-teacher-1" });
        await postConfirmationHandler(event);

        const [cognitoCall] = mockCognitoSend.mock.calls[0];
        expect(cognitoCall.input.GroupName).toBe("Teachers");
    });

    it("throws when custom:role is missing", async () => {
        const event = {
            userPoolId: "us-east-1_ABC",
            userName: "no_role",
            request: { userAttributes: { sub: "sub-no-role" } },
        } as any;
        await expect(postConfirmationHandler(event)).rejects.toThrow("Missing custom:role");
    });

    it("silently ignores ConditionalCheckFailedException (user already exists in DynamoDB)", async () => {
        mockCognitoSend.mockResolvedValueOnce({});
        const condErr = new Error("Conditional check failed");
        condErr.name = "ConditionalCheckFailedException";
        mockDdbSend.mockRejectedValueOnce(condErr);

        const event = makePostConfirmationEvent({ role: "STUDENT" });
        // Should NOT throw
        await expect(postConfirmationHandler(event)).resolves.toBe(event);
    });

    it("re-throws non-conditional DynamoDB errors", async () => {
        mockCognitoSend.mockResolvedValueOnce({});
        const dbErr = new Error("ProvisionedThroughputExceededException");
        dbErr.name = "ProvisionedThroughputExceededException";
        mockDdbSend.mockRejectedValueOnce(dbErr);

        const event = makePostConfirmationEvent({ role: "STUDENT" });
        await expect(postConfirmationHandler(event)).rejects.toMatchObject({
            name: "ProvisionedThroughputExceededException",
        });
    });

    it("propagates Cognito errors (group assignment failure)", async () => {
        const cognitoErr = new Error("GroupNotFoundException");
        cognitoErr.name = "GroupNotFoundException";
        mockCognitoSend.mockRejectedValueOnce(cognitoErr);

        const event = makePostConfirmationEvent({ role: "STUDENT" });
        await expect(postConfirmationHandler(event)).rejects.toMatchObject({
            name: "GroupNotFoundException",
        });
    });
});

// ---------------------------------------------------------------------------
// teacher-forgot-password
// ---------------------------------------------------------------------------
describe("teacher-forgot-password handler", () => {
    it("returns 200 for a valid email", async () => {
        mockCognitoSend.mockResolvedValueOnce({});

        const res = await teacherForgotPasswordHandler(makeHttpEvent({ email: "jane@school.edu" }));

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ ok: true });
    });

    it("calls Cognito ForgotPassword with the right ClientId and email", async () => {
        mockCognitoSend.mockResolvedValueOnce({});

        await teacherForgotPasswordHandler(makeHttpEvent({ email: "  jane@school.edu  " }));

        const [call] = mockCognitoSend.mock.calls[0];
        expect(call.input.ClientId).toBe("test-client-id");
        expect(call.input.Username).toBe("jane@school.edu"); // trimmed
    });

    it("returns 400 when email is missing", async () => {
        const res = await teacherForgotPasswordHandler(makeHttpEvent({}));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when email has no @ symbol", async () => {
        const res = await teacherForgotPasswordHandler(makeHttpEvent({ email: "notanemail" }));
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("VALIDATION_ERROR");
    });

    it("still returns 200 when Cognito throws (does not leak account existence)", async () => {
        const cognitoErr = new Error("UserNotFoundException");
        cognitoErr.name = "UserNotFoundException";
        mockCognitoSend.mockRejectedValueOnce(cognitoErr);

        const res = await teacherForgotPasswordHandler(makeHttpEvent({ email: "ghost@school.edu" }));

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ ok: true });
    });

    it("handles empty body gracefully (returns 400)", async () => {
        const res = await teacherForgotPasswordHandler({ body: null } as any);
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// teacher-confirm-forgot-password
// ---------------------------------------------------------------------------
describe("teacher-confirm-forgot-password handler", () => {
    const validBody = {
        email: "jane@school.edu",
        code: "123456",
        newPassword: "NewPass123!",
    };

    it("returns 200 on success", async () => {
        mockCognitoSend.mockResolvedValueOnce({});

        const res = await teacherConfirmForgotHandler(makeHttpEvent(validBody));

        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ ok: true });
    });

    it("passes correct fields to Cognito", async () => {
        mockCognitoSend.mockResolvedValueOnce({});

        await teacherConfirmForgotHandler(makeHttpEvent(validBody));

        const [call] = mockCognitoSend.mock.calls[0];
        expect(call.input.ClientId).toBe("test-client-id");
        expect(call.input.Username).toBe("jane@school.edu");
        expect(call.input.ConfirmationCode).toBe("123456");
        expect(call.input.Password).toBe("NewPass123!");
    });

    it("returns 400 VALIDATION_ERROR when email is missing", async () => {
        const res = await teacherConfirmForgotHandler(
            makeHttpEvent({ code: "123456", newPassword: "NewPass123!" })
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("VALIDATION_ERROR");
    });

    it("returns 400 VALIDATION_ERROR when code is missing", async () => {
        const res = await teacherConfirmForgotHandler(
            makeHttpEvent({ email: "jane@school.edu", newPassword: "NewPass123!" })
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("VALIDATION_ERROR");
    });

    it("returns 400 VALIDATION_ERROR when newPassword is missing", async () => {
        const res = await teacherConfirmForgotHandler(
            makeHttpEvent({ email: "jane@school.edu", code: "123456" })
        );
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("VALIDATION_ERROR");
    });

    it("returns 400 INVALID_CODE on CodeMismatchException", async () => {
        const err = new Error("CodeMismatchException");
        err.name = "CodeMismatchException";
        mockCognitoSend.mockRejectedValueOnce(err);

        const res = await teacherConfirmForgotHandler(makeHttpEvent(validBody));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_CODE");
    });

    it("returns 400 EXPIRED_CODE on ExpiredCodeException", async () => {
        const err = new Error("ExpiredCodeException");
        err.name = "ExpiredCodeException";
        mockCognitoSend.mockRejectedValueOnce(err);

        const res = await teacherConfirmForgotHandler(makeHttpEvent(validBody));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("EXPIRED_CODE");
    });

    it("returns 400 WEAK_PASSWORD on InvalidPasswordException", async () => {
        const err = new Error("InvalidPasswordException");
        err.name = "InvalidPasswordException";
        mockCognitoSend.mockRejectedValueOnce(err);

        const res = await teacherConfirmForgotHandler(makeHttpEvent(validBody));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("WEAK_PASSWORD");
    });

    it("returns 429 TOO_MANY_ATTEMPTS on LimitExceededException", async () => {
        const err = new Error("LimitExceededException");
        err.name = "LimitExceededException";
        mockCognitoSend.mockRejectedValueOnce(err);

        const res = await teacherConfirmForgotHandler(makeHttpEvent(validBody));

        expect(res.statusCode).toBe(429);
        expect(JSON.parse(res.body).error).toBe("TOO_MANY_ATTEMPTS");
    });

    it("returns 400 RESET_FAILED for an unknown Cognito error", async () => {
        const err = new Error("InternalErrorException");
        err.name = "InternalErrorException";
        mockCognitoSend.mockRejectedValueOnce(err);

        const res = await teacherConfirmForgotHandler(makeHttpEvent(validBody));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("RESET_FAILED");
    });

    it("handles empty body gracefully (returns 400 VALIDATION_ERROR)", async () => {
        const res = await teacherConfirmForgotHandler({ body: null } as any);
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("VALIDATION_ERROR");
    });
});

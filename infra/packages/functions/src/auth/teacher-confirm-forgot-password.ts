import { CognitoIdentityProviderClient, ConfirmForgotPasswordCommand } from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

const ERROR_MAP: Record<string, { status: number; code: string }> = {
    CodeMismatchException:    { status: 400, code: "INVALID_CODE" },
    ExpiredCodeException:     { status: 400, code: "EXPIRED_CODE" },
    InvalidPasswordException: { status: 400, code: "WEAK_PASSWORD" },
    LimitExceededException:   { status: 429, code: "TOO_MANY_ATTEMPTS" },
};

export const handler = async (event: any) => {
    const body = JSON.parse(event.body ?? "{}");
    const email: string      = (body.email       ?? "").trim();
    const code: string       = (body.code        ?? "").trim();
    const newPassword: string = (body.newPassword ?? "").trim();

    if (!email || !code || !newPassword) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "VALIDATION_ERROR" }),
        };
    }

    try {
        await client.send(new ConfirmForgotPasswordCommand({
            ClientId: process.env.USER_POOL_CLIENT_ID!,
            Username: email,
            ConfirmationCode: code,
            Password: newPassword,
        }));
    } catch (err: any) {
        const mapped = ERROR_MAP[err?.name];
        const { status, code: errorCode } = mapped ?? { status: 400, code: "RESET_FAILED" };
        return {
            statusCode: status,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: errorCode }),
        };
    }

    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true }),
    };
};

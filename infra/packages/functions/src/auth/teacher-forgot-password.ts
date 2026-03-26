import { CognitoIdentityProviderClient, ForgotPasswordCommand } from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

export const handler = async (event: any) => {
    const body = JSON.parse(event.body ?? "{}");
    const email: string = (body.email ?? "").trim();

    if (!email || !email.includes("@")) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "VALIDATION_ERROR" }),
        };
    }

    try {
        await client.send(new ForgotPasswordCommand({
            ClientId: process.env.USER_POOL_CLIENT_ID!,
            Username: email,
        }));
    } catch {
        // Intentionally swallowed — never reveal whether the account exists
    }

    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true }),
    };
};

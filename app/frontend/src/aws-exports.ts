const region = import.meta.env.VITE_AWS_REGION as string;
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string;
const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID as string;

if (!region || !userPoolId || !userPoolClientId) {
    throw new Error("Missing Cognito env vars. Set VITE_AWS_REGION, VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_USER_POOL_CLIENT_ID in .env.local");
    }

    export default {
    Auth: {
        Cognito: {
        region,
        userPoolId,
        userPoolClientId,
        },
    },
};

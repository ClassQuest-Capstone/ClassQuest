const region = import.meta.env.VITE_AWS_REGION as string;
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string;
const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID as string;

if (!region || !userPoolId || !userPoolClientId) {
    throw new Error("Missing Cognito env vars. Set VITE_AWS_REGION, VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_USER_POOL_CLIENT_ID in .env.local");
}

// Optional AppSync config — only wired when env vars are present.
// Set VITE_APPSYNC_API_URL and VITE_APPSYNC_API_KEY in .env.local after deploying AppSyncStack.
const appSyncApiUrl = import.meta.env.VITE_APPSYNC_API_URL as string | undefined;
const appSyncApiKey = import.meta.env.VITE_APPSYNC_API_KEY as string | undefined;

const apiConfig = appSyncApiUrl
    ? {
          API: {
              GraphQL: {
                  endpoint: appSyncApiUrl,
                  region,
                  defaultAuthMode: "userPool" as const,
                  ...(appSyncApiKey ? { apiKey: appSyncApiKey } : {}),
              },
          },
      }
    : {};

export default {
    Auth: {
        Cognito: {
            region,
            userPoolId,
            userPoolClientId,
        },
    },
    ...apiConfig,
};

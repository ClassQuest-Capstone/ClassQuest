import { listSchools } from "./repo.ts";

/**
 * GET /schools
 * List all schools (for dropdown population in frontend)
 */
export const handler = async (event: any) => {
    // TODO AUTH: Can be public or require authentication depending on requirements
    // For teacher signup, this may need to be accessible before authentication

    const items = await listSchools();

    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
    };
};

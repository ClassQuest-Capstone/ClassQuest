import { listClassesBySchool } from "./repo.ts";

/**
 * GET /schools/{school_id}/classes
 * List all classes in a school (multi-tenancy query)
 */
export const handler = async (event: any) => {
    // ============================================================
    // TODO AUTH: Extract Cognito JWT and verify user belongs to this school
    // Teachers: Can only list classes in their own school
    // Students: Can only list classes in their own school
    // Admins: Can only list classes in their own school
    // Return 403 if school_id doesn't match user's school
    // ============================================================

    // Step 1: Extract school_id from URL path parameters
    const school_id = event.pathParameters?.school_id;

    if (!school_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_SCHOOL_ID" }),
        };
    }

    // Step 2: Query GSI2 (school_id partition key) to get all classes in school
    // This is the primary multi-tenancy query pattern
    const items = await listClassesBySchool(school_id);

    // Step 3: Return array of classes (all classes in the school)
    // Note: Currently returns both active and deactivated classes
    // TODO: Add optional query parameter ?is_active=true to filter
    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
    };
};

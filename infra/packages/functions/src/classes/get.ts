import { getClass } from "./repo.ts";

/**
 * GET /classes/{class_id}
 * Retrieve a single class by its ID
 */
export const handler = async (event: any) => {
    // ============================================================
    // TODO AUTH: Extract Cognito JWT and verify user has access to this class
    // Teachers: Can view classes they created or classes in their school
    // Students: Can only view classes they're enrolled in (requires StudentEnrollments table)
    // Admins: Can view all classes in their school
    // ============================================================

    // Step 1: Extract class_id from URL path parameters
    // API Gateway injects this from route pattern /classes/{class_id}
    const class_id = event.pathParameters?.class_id;

    if (!class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_CLASS_ID" }),
        };
    }

    // Step 2: Fetch class from DynamoDB by primary key
    const item = await getClass(class_id);

    // ============================================================
    // TODO AUTH: After fetching, verify user has permission to view this class
    // Check item.school_id matches user's school_id
    // Check item.created_by_teacher_id matches user's teacher_id (if teacher)
    // Return 403 if unauthorized
    // ============================================================

    // Step 3: Return class or 404 if not found
    return {
        statusCode: item ? 200 : 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item ?? { error: "CLASS_NOT_FOUND" }),
    };
};

import { listClassesByTeacher } from "./repo.ts";

/**
 * GET /teachers/{teacher_id}/classes
 * List all classes created by a teacher
 */
export const handler = async (event: any) => {
    // ============================================================
    // TODO AUTH: Extract Cognito JWT and verify user is authorized
    // Teachers: Can only list their own classes (teacher_id matches JWT)
    // Admins: Can list any teacher's classes in their school
    // Return 403 if unauthorized
    // ============================================================

    // Step 1: Extract teacher_id from URL path parameters
    const teacher_id = event.pathParameters?.teacher_id;

    if (!teacher_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_TEACHER_ID" }),
        };
    }

    // Step 2: Query GSI1 (created_by_teacher_id partition key) to get all classes
    // Returns all classes created by this teacher (across all schools they've taught at)
    const items = await listClassesByTeacher(teacher_id);

    // ============================================================
    // TODO AUTH: Filter results to only include classes from user's school
    // items.filter(item => item.school_id === userSchoolId)
    // This prevents teachers from seeing classes they created at previous schools
    // ============================================================

    // Step 3: Return array of classes (empty array if none found)
    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }), // Wrapped in envelope for consistency
    };
};

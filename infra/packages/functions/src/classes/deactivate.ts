import { deactivateClass } from "./repo.ts";

/**
 * PATCH /classes/{class_id}/deactivate
 * Deactivate a class (soft delete)
 */
export const handler = async (event: any) => {
    // ============================================================
    // TODO AUTH: Extract Cognito JWT and verify user can deactivate this class
    // Teachers: Can only deactivate classes they created
    // Admins: Can deactivate any class in their school
    // Students: Cannot deactivate classes (return 403)
    // ============================================================

    // Step 1: Extract class_id from URL path parameters
    const class_id = event.pathParameters?.class_id;

    if (!class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_CLASS_ID" }),
        };
    }

    // ============================================================
    // TODO AUTH: Fetch the class first to verify permissions before deactivating
    // const classItem = await getClass(class_id);
    // if (!classItem) return 404;
    // if (classItem.created_by_teacher_id !== userTeacherId && !isAdmin) return 403;
    // ============================================================

    try {
        // Step 2: Update DynamoDB to set is_active=false, deactivated_at=now, updated_at=now
        // Uses UpdateCommand with conditional expression (first UPDATE in codebase)
        await deactivateClass(class_id);

        // Step 3: Return success response
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                message: "Class deactivated successfully",
                class_id,
            }),
        };
    } catch (error: any) {
        // Step 4: Handle case where class doesn't exist
        // ConditionalCheckFailedException occurs when attribute_exists(class_id) fails
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "CLASS_NOT_FOUND" }),
            };
        }

        // Unexpected error, log and re-throw for Lambda error handling
        console.error("Error deactivating class:", error);
        throw error;
    }
};

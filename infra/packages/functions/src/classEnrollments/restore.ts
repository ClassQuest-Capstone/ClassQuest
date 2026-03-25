import { findEnrollmentByClassAndStudent, restoreEnrollment } from "./repo.ts";

/**
 * POST /classes/{class_id}/students/{student_id}/restore
 *
 * Restore a previously dropped student enrollment back to active.
 * Teacher-only: teacher must own or have access to the class.
 *
 * Responses:
 *   200 — enrollment restored, returns updated record
 *   400 — missing path parameters
 *   404 — no enrollment found for this class + student
 *   409 — enrollment is already active (ALREADY_ACTIVE)
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify caller is a teacher who owns this class

    const class_id   = event.pathParameters?.class_id;
    const student_id = event.pathParameters?.student_id;

    if (!class_id || !student_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_PATH_PARAMS", message: "class_id and student_id are required" }),
        };
    }

    // Find existing enrollment for this class + student
    const enrollment = await findEnrollmentByClassAndStudent(class_id, student_id);

    if (!enrollment) {
        return {
            statusCode: 404,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "ENROLLMENT_NOT_FOUND", message: "No enrollment found for this student in this class" }),
        };
    }

    if (enrollment.status === "active") {
        return {
            statusCode: 409,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "ALREADY_ACTIVE",
                message: "Student is already active in this class",
                enrollment_id: enrollment.enrollment_id,
            }),
        };
    }

    // Restore the dropped enrollment
    const restored = await restoreEnrollment(enrollment.enrollment_id);

    return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(restored),
    };
};

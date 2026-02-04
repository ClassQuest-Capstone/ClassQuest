import { randomUUID } from "crypto";
import type { EnrollmentItem } from "./types.ts";
import { putEnrollment, findEnrollmentByClassAndStudent } from "./repo.ts";

/**
 * POST /classes/{class_id}/enroll
 * Student joins a class
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify student is authenticated and matches student_id in body

    // Step 1: Extract class_id from path parameters
    const class_id = event.pathParameters?.class_id;

    if (!class_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_CLASS_ID" }),
        };
    }

    // Step 2: Parse request body
    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : rawBody ?? {};

    const { student_id } = body;

    if (!student_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_STUDENT_ID",
                message: "Required field: student_id",
            }),
        };
    }

    if (typeof student_id !== "string" || student_id.trim() === "") {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_STUDENT_ID",
                message: "student_id must be a non-empty string",
            }),
        };
    }

    // TODO AUTH: Verify student_id matches authenticated user
    // TODO: Verify class exists and is active (optional)

    // Step 3: Check for existing enrollment (prevent duplicates)
    const existing = await findEnrollmentByClassAndStudent(
        class_id,
        student_id
    );

    if (existing) {
        if (existing.status === "active") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "ALREADY_ENROLLED",
                    message: "Student is already enrolled in this class",
                    enrollment_id: existing.enrollment_id,
                }),
            };
        } else if (existing.status === "dropped") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "PREVIOUSLY_DROPPED",
                    message:
                        "Student previously dropped this class and cannot re-enroll",
                    enrollment_id: existing.enrollment_id,
                }),
            };
        }
    }

    // Step 4: Create new enrollment
    const enrollment_id = randomUUID();
    const now = new Date().toISOString();

    const item: EnrollmentItem = {
        enrollment_id,
        class_id: class_id.trim(),
        student_id: student_id.trim(),
        joined_at: now,
        status: "active",
    };

    try {
        await putEnrollment(item);

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                enrollment_id,
                message: "Successfully enrolled in class",
            }),
        };
    } catch (error: any) {
        console.error("Error creating enrollment:", error);
        throw error;
    }
};

import { randomUUID } from "crypto";
import type { ClassItem } from "./types.ts";
import { generateJoinCode } from "./joinCode.ts";
import { putClass } from "./repo.ts";

/**
 * POST /classes
 * Create a new class with auto-generated join code
 *
 * Request Body:
 * {
 *   "school_id": "string",
 *   "name": "string",
 *   "grade_level": number,
 *   "created_by_teacher_id": "string",
 *   "subject": "string" (optional)
 * }
 */
export const handler = async (event: any) => {
    // ============================================================
    // TODO AUTH: Extract Cognito JWT from event.requestContext.authorizer.jwt
    // Verify the user is a teacher (check Cognito groups)
    // Extract actual teacher_id from verified token claims
    // ============================================================

    // Step 1: Parse request body (handles both string and object formats from API Gateway)
    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : rawBody ?? {};

    // Step 2: Validate required fields exist
    const { school_id, name, grade_level, created_by_teacher_id, subject } =
        body;

    if (
        !school_id ||
        !name ||
        grade_level === undefined ||
        !created_by_teacher_id
    ) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_REQUIRED_FIELDS",
                message:
                    "Required fields: school_id, name, grade_level, created_by_teacher_id",
            }),
        };
    }

    // Step 3: Validate field types and non-empty strings
    if (typeof school_id !== "string" || school_id.trim() === "") {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_SCHOOL_ID",
                message: "school_id must be a non-empty string",
            }),
        };
    }

    if (typeof name !== "string" || name.trim() === "") {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_NAME",
                message: "name must be a non-empty string",
            }),
        };
    }

    if (typeof grade_level !== "number" || !Number.isInteger(grade_level)) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_GRADE_LEVEL",
                message: "grade_level must be an integer",
            }),
        };
    }

    if (
        typeof created_by_teacher_id !== "string" ||
        created_by_teacher_id.trim() === ""
    ) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_TEACHER_ID",
                message: "created_by_teacher_id must be a non-empty string",
            }),
        };
    }

    if (subject !== undefined && (typeof subject !== "string" || subject.trim() === "")) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_SUBJECT",
                message: "subject must be a non-empty string if provided",
            }),
        };
    }

    // ============================================================
    // TODO AUTH: Verify teacher can create classes in this school
    // Query TeacherProfiles table to confirm created_by_teacher_id belongs to school_id
    // Return 403 if teacher doesn't belong to the school
    // ============================================================

    // Step 4: Generate unique identifiers
    const class_id = randomUUID(); // Crypto-secure UUID for primary key
    const now = new Date().toISOString(); // Timestamp for created_at

    // Step 5: Retry loop for join code collision handling (max 5 attempts)
    const MAX_RETRIES = 5;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const join_code = generateJoinCode(6); // 6-char uppercase alnum code

        const item: ClassItem = {
            class_id,
            school_id: school_id.trim(),
            name: name.trim(),
            ...(subject && { subject: subject.trim() }), // Only include if provided
            grade_level,
            created_by_teacher_id: created_by_teacher_id.trim(),
            join_code,
            is_active: true, // New classes start active
            deactivated_at: undefined, // Not deactivated yet
            created_at: now,
        };

        try {
            // Attempt to write to DynamoDB with conditional expression
            await putClass(item); // Will throw ConditionalCheckFailedException if collision

            // Success! Return created class with join code
            return {
                statusCode: 201,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    class_id,
                    join_code,
                    message: "Class created successfully",
                }),
            };
        } catch (error: any) {
            // Handle join_code collision (rare but possible)
            if (error.name === "ConditionalCheckFailedException") {
                console.log(
                    `Join code collision on attempt ${attempt}/${MAX_RETRIES}: ${join_code}`
                );

                if (attempt === MAX_RETRIES) {
                    // Exhausted all retries, return conflict error
                    return {
                        statusCode: 409,
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                            error: "JOIN_CODE_COLLISION_AFTER_RETRIES",
                            message:
                                "Failed to generate unique join code after multiple attempts",
                        }),
                    };
                }
                // Retry with new join code
                continue;
            }

            // Unexpected error, log and re-throw for Lambda to handle
            console.error("Error creating class:", error);
            throw error;
        }
    }
};

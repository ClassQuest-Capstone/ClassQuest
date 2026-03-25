import { getClass, updateClass, type UpdateClassFields } from "./repo.ts";

/**
 * PATCH /classes/{class_id}
 *
 * Update allowed fields of an existing class.
 *
 * Editable fields:  name, subject, grade_level, is_active
 * Protected fields: class_id, school_id, created_by_teacher_id, join_code,
 *                   created_at, updated_at (auto-set), deactivated_at (auto-set)
 *
 * Business rules:
 * - At least one editable field must be present.
 * - name must be a non-empty string (≤ 100 chars).
 * - subject must be a non-empty string when provided (≤ 100 chars).
 * - grade_level must be an integer in [1, 12].
 * - is_active must be a boolean.
 * - is_active true→false: sets deactivated_at automatically.
 * - is_active false→true: clears deactivated_at automatically.
 *
 * Authorization:
 * - Only the teacher who created the class may edit it.
 * - TODO: replace teacher_id extraction with real Cognito JWT validation.
 */
export const handler = async (event: any) => {
    // ----------------------------------------------------------------
    // TODO AUTH: Extract and verify Cognito JWT, resolve teacher_id.
    // Until then the caller passes x-teacher-id header (dev only).
    // ----------------------------------------------------------------
    const requestingTeacherId =
        event.headers?.["x-teacher-id"] ??
        event.requestContext?.authorizer?.jwt?.claims?.["custom:teacher_id"];

    const class_id = event.pathParameters?.class_id;
    if (!class_id) {
        return resp(400, { error: "MISSING_CLASS_ID" });
    }

    // ----------------------------------------------------------------
    // Parse body
    // ----------------------------------------------------------------
    let body: Record<string, unknown>;
    try {
        body = JSON.parse(event.body ?? "{}");
    } catch {
        return resp(400, { error: "INVALID_JSON" });
    }

    // ----------------------------------------------------------------
    // Validate — only recognized editable fields allowed
    // ----------------------------------------------------------------
    const EDITABLE = new Set(["name", "subject", "grade_level", "is_active"]);
    const unknownKeys = Object.keys(body).filter((k) => !EDITABLE.has(k));
    if (unknownKeys.length > 0) {
        return resp(400, { error: "UNKNOWN_FIELDS", fields: unknownKeys });
    }

    const fields: UpdateClassFields = {};

    if (body.name !== undefined) {
        if (typeof body.name !== "string" || body.name.trim() === "") {
            return resp(400, { error: "INVALID_NAME", message: "name must be a non-empty string" });
        }
        if (body.name.trim().length > 100) {
            return resp(400, { error: "INVALID_NAME", message: "name must be 100 characters or fewer" });
        }
        fields.name = body.name.trim();
    }

    if (body.subject !== undefined) {
        if (typeof body.subject !== "string" || body.subject.trim() === "") {
            return resp(400, { error: "INVALID_SUBJECT", message: "subject must be a non-empty string" });
        }
        if (body.subject.trim().length > 100) {
            return resp(400, { error: "INVALID_SUBJECT", message: "subject must be 100 characters or fewer" });
        }
        fields.subject = body.subject.trim();
    }

    if (body.grade_level !== undefined) {
        const gl = body.grade_level;
        if (!Number.isInteger(gl) || (gl as number) < 1 || (gl as number) > 12) {
            return resp(400, {
                error: "INVALID_GRADE_LEVEL",
                message: "grade_level must be an integer between 1 and 12",
            });
        }
        fields.grade_level = gl as number;
    }

    if (body.is_active !== undefined) {
        if (typeof body.is_active !== "boolean") {
            return resp(400, { error: "INVALID_IS_ACTIVE", message: "is_active must be a boolean" });
        }
        fields.is_active = body.is_active;
    }

    if (Object.keys(fields).length === 0) {
        return resp(400, { error: "NO_EDITABLE_FIELDS", message: "Request must include at least one editable field" });
    }

    // ----------------------------------------------------------------
    // Load existing class (needed for auth check + deactivated_at logic)
    // ----------------------------------------------------------------
    const existing = await getClass(class_id);
    if (!existing) {
        return resp(404, { error: "CLASS_NOT_FOUND" });
    }

    // ----------------------------------------------------------------
    // Authorization: only the creating teacher may edit
    // ----------------------------------------------------------------
    if (requestingTeacherId && existing.created_by_teacher_id !== requestingTeacherId) {
        return resp(403, { error: "FORBIDDEN", message: "Only the class owner may edit this class" });
    }

    // ----------------------------------------------------------------
    // Apply update
    // ----------------------------------------------------------------
    try {
        const updated = await updateClass(class_id, fields, existing.is_active);
        return resp(200, updated);
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return resp(404, { error: "CLASS_NOT_FOUND" });
        }
        console.error("Error updating class:", error);
        throw error;
    }
};

function resp(statusCode: number, body: unknown) {
    return {
        statusCode,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    };
}

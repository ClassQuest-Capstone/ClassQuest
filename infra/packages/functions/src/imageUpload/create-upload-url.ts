import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// TODO later: support image import from URL by downloading server-side and storing in S3

const ALLOWED_CONTENT_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
] as const;

type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const PRESIGNED_URL_EXPIRES_IN_SECONDS = 300; // 5 minutes

const s3 = new S3Client({});
const BUCKET = process.env.ASSETS_BUCKET_NAME;

if (!BUCKET) {
    throw new Error("Missing ASSETS_BUCKET_NAME environment variable");
}

type EntityType = "reward" | "quest-question" | "boss-question";

const ENTITY_FOLDER: Record<EntityType, string> = {
    "reward": "rewards",
    "quest-question": "quest-questions",
    "boss-question": "boss-questions",
};

/**
 * POST /teacher/images/upload-url
 * Generate a presigned S3 PUT URL for direct browser image upload.
 *
 * Body:
 *   teacher_id    — teacher performing the upload (TODO: replace with JWT claim once auth is wired)
 *   entity_type   — "reward" | "quest-question" | "boss-question"
 *   content_type  — MIME type (image/jpeg | image/png | image/gif | image/webp)
 *   file_size?    — optional file size in bytes; validated against 5 MB limit if provided
 *
 * Response:
 *   uploadUrl      — presigned S3 PUT URL (valid for 5 minutes)
 *   imageAssetKey  — S3 object key; store this in DynamoDB
 *
 * S3 key pattern: teachers/{teacherId}/{entityFolder}/{uuid}.{ext}
 *
 * Auth: teacher only — caller must supply teacher_id until Cognito JWT auth is wired.
 * TODO: replace teacher_id body field with JWT sub claim once auth is implemented.
 */
export const handler = async (event: any) => {
    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : rawBody ?? {};

    const { teacher_id, entity_type, content_type, file_size } = body;

    // Validate teacher_id
    if (!teacher_id || typeof teacher_id !== "string" || !teacher_id.trim()) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_TEACHER_ID",
                message: "teacher_id is required",
            }),
        };
    }

    // Validate content_type
    if (!content_type || !(ALLOWED_CONTENT_TYPES as readonly string[]).includes(content_type)) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_CONTENT_TYPE",
                message: `content_type must be one of: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
                allowed: ALLOWED_CONTENT_TYPES,
            }),
        };
    }

    // Validate file_size if provided
    if (file_size !== undefined) {
        const size = Number(file_size);
        if (!Number.isFinite(size) || size <= 0) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "INVALID_FILE_SIZE",
                    message: "file_size must be a positive number",
                }),
            };
        }
        if (size > MAX_FILE_SIZE_BYTES) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "FILE_TOO_LARGE",
                    message: `File size exceeds the maximum of ${MAX_FILE_SIZE_BYTES} bytes (5 MB)`,
                    maxBytes: MAX_FILE_SIZE_BYTES,
                }),
            };
        }
    }

    // Resolve entity folder; default to "images" for unknown types
    const folder = ENTITY_FOLDER[entity_type as EntityType] ?? "images";

    // Derive file extension from content_type (jpeg → jpg)
    const rawExt = (content_type as AllowedContentType).split("/")[1] ?? "jpg";
    const ext = rawExt === "jpeg" ? "jpg" : rawExt;

    // Build S3 object key
    const imageAssetKey = `teachers/${teacher_id.trim()}/${folder}/${randomUUID()}.${ext}`;

    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET!,
            Key: imageAssetKey,
            ContentType: content_type,
            ...(file_size !== undefined && { ContentLength: Number(file_size) }),
        });

        const uploadUrl = await getSignedUrl(s3, command, {
            expiresIn: PRESIGNED_URL_EXPIRES_IN_SECONDS,
        });

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ uploadUrl, imageAssetKey }),
        };
    } catch (err: any) {
        console.error("Error generating presigned upload URL:", err);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "INTERNAL_SERVER_ERROR", message: err.message }),
        };
    }
};

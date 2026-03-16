/**
 * Image upload API client.
 *
 * Flow:
 *   1. Call `createImageUploadUrl` to get a presigned PUT URL and an imageAssetKey.
 *   2. Call `uploadToS3` to PUT the file directly to S3 (no auth header needed).
 *   3. Store the returned `imageAssetKey` in form state.
 *   4. Submit the create/update API with `image_asset_key: imageAssetKey`.
 *
 * To remove an image from a persisted record, pass `image_asset_key: null` in the
 * entity update payload (e.g. updateRewardMilestone, updateBossQuestion, etc.).
 *
 * TODO later: support image import from URL by downloading server-side and storing in S3
 */

import { api } from "../http.js";
import type {
    CreateImageUploadUrlRequest,
    CreateImageUploadUrlResponse,
} from "./types.js";

/**
 * Request a presigned S3 PUT URL for a new image upload.
 * POST /teacher/images/upload-url
 */
export function createImageUploadUrl(
    payload: CreateImageUploadUrlRequest
): Promise<CreateImageUploadUrlResponse> {
    return api<CreateImageUploadUrlResponse>("/teacher/images/upload-url", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * Upload a file directly to S3 using a presigned PUT URL.
 * No Authorization header — the URL itself grants write access.
 *
 * @throws Error if the S3 PUT request returns a non-2xx status.
 */
export async function uploadToS3(
    uploadUrl: string,
    file: File
): Promise<void> {
    const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
            "Content-Type": file.type,
        },
    });

    if (!res.ok) {
        throw new Error(`S3 upload failed: HTTP ${res.status}`);
    }
}

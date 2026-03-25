/**
 * Asset URL helper.
 *
 * Images are stored in a private S3 bucket and delivered through CloudFront.
 * DynamoDB records store only `image_asset_key` (S3 object key).
 * This helper builds the full display URL at runtime from the CDN domain + key.
 *
 * Configure the CDN domain in .env.local:
 *   VITE_ASSETS_CDN_URL=https://<distribution>.cloudfront.net
 * Value appears in CloudFormation outputs as `TeacherAssetsCdnDomain` after deploying.
 */

const CDN_BASE_URL = (import.meta.env.VITE_ASSETS_CDN_URL as string | undefined)
    ?.replace(/\/$/, "");

/**
 * Build a public CDN URL from a stored image_asset_key.
 *
 * @param imageAssetKey - The S3 object key stored in DynamoDB (e.g. "teachers/abc/rewards/uuid.png")
 * @returns Full CloudFront URL, or undefined if the key or CDN base URL is absent.
 *
 * @example
 *   getAssetUrl("teachers/abc/rewards/uuid.png")
 *   // => "https://d1234.cloudfront.net/teachers/abc/rewards/uuid.png"
 */
export function getAssetUrl(imageAssetKey: string | null | undefined): string | undefined {
    if (!imageAssetKey || !CDN_BASE_URL) return undefined;
    return `${CDN_BASE_URL}/${imageAssetKey}`;
}

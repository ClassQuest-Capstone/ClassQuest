/**
 * Unit tests for imageUpload/create-upload-url.ts
 *
 * Run with Vitest:
 *   cd infra/packages/functions && npx vitest run --reporter=verbose src/imageUpload
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock AWS S3 SDK
// ---------------------------------------------------------------------------
const mockGetSignedUrl = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
    S3Client:         vi.fn(function () { return {}; }),
    PutObjectCommand: vi.fn(function (input: any) { return { input }; }),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
    getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

// ---------------------------------------------------------------------------
// Module reference — env var must be set before dynamic import
// ---------------------------------------------------------------------------
let handler: (typeof import("../create-upload-url.ts"))["handler"];

beforeAll(async () => {
    process.env.ASSETS_BUCKET_NAME = "test-assets-bucket";
    handler = (await import("../create-upload-url.ts")).handler;
});

beforeEach(() => {
    mockGetSignedUrl.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeBody(overrides: Record<string, any> = {}) {
    return {
        teacher_id:   "teacher-1",
        entity_type:  "reward",
        content_type: "image/png",
        ...overrides,
    };
}

function makeEvent(body: Record<string, any> | string | null | undefined = makeBody()) {
    return {
        body: body === null || body === undefined ? body : (typeof body === "string" ? body : JSON.stringify(body)),
    };
}

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------
describe("success path", () => {
    it("returns 200 with uploadUrl and imageAssetKey", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent());

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.uploadUrl).toBe("https://s3.example.com/presigned");
        expect(body.imageAssetKey).toBeTruthy();
    });

    it("imageAssetKey starts with teachers/{teacher_id}/", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ teacher_id: "teacher-abc" })));

        const { imageAssetKey } = JSON.parse(res.body);
        expect(imageAssetKey).toMatch(/^teachers\/teacher-abc\//);
    });

    it("imageAssetKey uses correct entity folder for 'reward'", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ entity_type: "reward" })));

        const { imageAssetKey } = JSON.parse(res.body);
        expect(imageAssetKey).toContain("/rewards/");
    });

    it("imageAssetKey uses correct entity folder for 'quest-question'", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ entity_type: "quest-question" })));

        const { imageAssetKey } = JSON.parse(res.body);
        expect(imageAssetKey).toContain("/quest-questions/");
    });

    it("imageAssetKey uses correct entity folder for 'boss-question'", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ entity_type: "boss-question" })));

        const { imageAssetKey } = JSON.parse(res.body);
        expect(imageAssetKey).toContain("/boss-questions/");
    });

    it("imageAssetKey defaults to 'images' folder for unknown entity_type", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ entity_type: "unknown-type" })));

        const { imageAssetKey } = JSON.parse(res.body);
        expect(imageAssetKey).toContain("/images/");
    });

    it("converts jpeg content_type to .jpg extension in key", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ content_type: "image/jpeg" })));

        const { imageAssetKey } = JSON.parse(res.body);
        expect(imageAssetKey).toMatch(/\.jpg$/);
    });

    it("uses .png extension for image/png", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ content_type: "image/png" })));

        const { imageAssetKey } = JSON.parse(res.body);
        expect(imageAssetKey).toMatch(/\.png$/);
    });

    it("uses .webp extension for image/webp", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ content_type: "image/webp" })));

        const { imageAssetKey } = JSON.parse(res.body);
        expect(imageAssetKey).toMatch(/\.webp$/);
    });

    it("trims whitespace from teacher_id in S3 key", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ teacher_id: "  teacher-1  " })));

        const { imageAssetKey } = JSON.parse(res.body);
        expect(imageAssetKey).toMatch(/^teachers\/teacher-1\//);
        expect(imageAssetKey).not.toContain(" ");
    });
});

// ---------------------------------------------------------------------------
// PutObjectCommand inputs
// ---------------------------------------------------------------------------
describe("PutObjectCommand inputs", () => {
    it("passes correct Bucket to PutObjectCommand", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        await handler(makeEvent());

        const command = mockGetSignedUrl.mock.calls[0][1];
        expect(command.input.Bucket).toBe("test-assets-bucket");
    });

    it("passes content_type as ContentType to PutObjectCommand", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        await handler(makeEvent(makeBody({ content_type: "image/gif" })));

        const command = mockGetSignedUrl.mock.calls[0][1];
        expect(command.input.ContentType).toBe("image/gif");
    });

    it("includes ContentLength when file_size is provided", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        await handler(makeEvent(makeBody({ file_size: 2048 })));

        const command = mockGetSignedUrl.mock.calls[0][1];
        expect(command.input.ContentLength).toBe(2048);
    });

    it("omits ContentLength when file_size is not provided", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        await handler(makeEvent(makeBody()));  // no file_size

        const command = mockGetSignedUrl.mock.calls[0][1];
        expect(command.input.ContentLength).toBeUndefined();
    });

    it("passes imageAssetKey as Key to PutObjectCommand", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent());

        const { imageAssetKey } = JSON.parse(res.body);
        const command = mockGetSignedUrl.mock.calls[0][1];
        expect(command.input.Key).toBe(imageAssetKey);
    });
});

// ---------------------------------------------------------------------------
// teacher_id validation
// ---------------------------------------------------------------------------
describe("teacher_id validation", () => {
    it("returns 400 when teacher_id is missing", async () => {
        const res = await handler(makeEvent(makeBody({ teacher_id: undefined })));

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toBe("MISSING_TEACHER_ID");
        expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it("returns 400 when teacher_id is empty string", async () => {
        const res = await handler(makeEvent(makeBody({ teacher_id: "" })));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_TEACHER_ID");
    });

    it("returns 400 when teacher_id is whitespace only", async () => {
        const res = await handler(makeEvent(makeBody({ teacher_id: "   " })));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_TEACHER_ID");
    });

    it("returns 400 when teacher_id is not a string", async () => {
        const res = await handler(makeEvent(makeBody({ teacher_id: 123 })));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_TEACHER_ID");
    });
});

// ---------------------------------------------------------------------------
// content_type validation
// ---------------------------------------------------------------------------
describe("content_type validation", () => {
    it("returns 400 when content_type is missing", async () => {
        const res = await handler(makeEvent(makeBody({ content_type: undefined })));

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toBe("INVALID_CONTENT_TYPE");
        expect(body.allowed).toContain("image/jpeg");
        expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it("returns 400 for disallowed content_type image/bmp", async () => {
        const res = await handler(makeEvent(makeBody({ content_type: "image/bmp" })));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_CONTENT_TYPE");
    });

    it("returns 400 for content_type application/octet-stream", async () => {
        const res = await handler(makeEvent(makeBody({ content_type: "application/octet-stream" })));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_CONTENT_TYPE");
    });

    it("accepts image/jpeg", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ content_type: "image/jpeg" })));

        expect(res.statusCode).toBe(200);
    });

    it("accepts image/gif", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ content_type: "image/gif" })));

        expect(res.statusCode).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// file_size validation
// ---------------------------------------------------------------------------
describe("file_size validation", () => {
    it("returns 400 when file_size is 0", async () => {
        const res = await handler(makeEvent(makeBody({ file_size: 0 })));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_FILE_SIZE");
        expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it("returns 400 when file_size is negative", async () => {
        const res = await handler(makeEvent(makeBody({ file_size: -100 })));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_FILE_SIZE");
    });

    it("returns 400 when file_size is not a number", async () => {
        const res = await handler(makeEvent(makeBody({ file_size: "notanumber" })));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("INVALID_FILE_SIZE");
    });

    it("returns 400 when file_size exceeds 5 MB", async () => {
        const tooBig = 5 * 1024 * 1024 + 1;

        const res = await handler(makeEvent(makeBody({ file_size: tooBig })));

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toBe("FILE_TOO_LARGE");
        expect(body.maxBytes).toBe(5 * 1024 * 1024);
    });

    it("accepts file_size exactly at 5 MB", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");
        const exactly5MB = 5 * 1024 * 1024;

        const res = await handler(makeEvent(makeBody({ file_size: exactly5MB })));

        expect(res.statusCode).toBe(200);
    });

    it("accepts file_size as a numeric string", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ file_size: "2048" })));

        expect(res.statusCode).toBe(200);
    });

    it("accepts valid file_size without triggering validation failure", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler(makeEvent(makeBody({ file_size: 1024 })));

        expect(res.statusCode).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// Body / request edge cases
// ---------------------------------------------------------------------------
describe("body edge cases", () => {
    it("returns 400 when body is null", async () => {
        const res = await handler(makeEvent(null));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_TEACHER_ID");
    });

    it("returns 400 when body is undefined", async () => {
        const res = await handler({ body: undefined });

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error).toBe("MISSING_TEACHER_ID");
    });

    it("returns 400 when event is empty object", async () => {
        const res = await handler({});

        expect(res.statusCode).toBe(400);
    });

    it("parses body correctly when provided as JSON string", async () => {
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/presigned");

        const res = await handler({ body: JSON.stringify(makeBody()) });

        expect(res.statusCode).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe("error handling", () => {
    it("returns 500 when getSignedUrl throws", async () => {
        mockGetSignedUrl.mockRejectedValue(new Error("S3 signing failure"));

        const res = await handler(makeEvent());

        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.body);
        expect(body.error).toBe("INTERNAL_SERVER_ERROR");
        expect(body.message).toContain("S3 signing failure");
    });
});

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { listBases, listBasesByGender } from "./repo.ts";
import { VALID_GENDERS } from "./validation.ts";

/**
 * GET /avatar-bases
 *
 * List all AvatarBases.
 * Optional query params:
 *   ?gender=MALE|FEMALE  — filter by gender using GSI1
 *   ?limit=N             — max items per page (1–500, default 100)
 *   ?cursor=<base64>     — pagination cursor from previous response
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const qs = event.queryStringParameters ?? {};

        // Parse limit
        let limit = 100;
        if (qs.limit !== undefined) {
            const parsed = parseInt(qs.limit, 10);
            if (isNaN(parsed) || parsed < 1) {
                return {
                    statusCode: 400,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ error: "limit must be a positive integer" }),
                };
            }
            limit = Math.min(parsed, 500);
        }

        const cursor = qs.cursor;
        const gender = qs.gender;

        // If gender filter provided, validate it and use GSI1
        if (gender !== undefined) {
            if (!VALID_GENDERS.includes(gender as any)) {
                return {
                    statusCode: 400,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ error: `gender must be one of: ${VALID_GENDERS.join(", ")}` }),
                };
            }

            const result = await listBasesByGender(gender, limit, cursor);
            return {
                statusCode: 200,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    items:  result.items,
                    count:  result.items.length,
                    cursor: result.cursor ?? null,
                    gender,
                }),
            };
        }

        // No filter — scan all
        const result = await listBases(limit, cursor);
        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                items:  result.items,
                count:  result.items.length,
                cursor: result.cursor ?? null,
            }),
        };
    } catch (error: any) {
        console.error("Error listing avatar bases:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

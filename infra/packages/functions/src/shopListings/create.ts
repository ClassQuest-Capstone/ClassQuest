import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { ShopListing } from "./types.ts";
import { createListing } from "./repo.ts";
import { buildAllListingKeys } from "./keys.ts";
import { validateShopListing } from "./validation.ts";

/**
 * POST /shop-listings
 *
 * Create a new ShopListing.
 * Supports both global listings (no class_id) and class-specific listings.
 * All GSI keys, PK/SK, and listing_status are computed — do not supply them directly.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const {
            shop_listing_id,
            item_id,
            available_from,
            available_to,
            is_active,
            class_id,
            purchase_limit_per_student,
            created_by,
            display_order,
        } = body;

        // Required fields
        if (!shop_listing_id || !item_id || !available_from || !available_to || is_active === undefined) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required fields",
                    required: ["shop_listing_id", "item_id", "available_from", "available_to", "is_active"],
                }),
            };
        }

        // Validation
        const validation = validateShopListing({
            shop_listing_id,
            item_id,
            available_from,
            available_to,
            is_active,
            class_id,
            purchase_limit_per_student,
            display_order,
        });

        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: validation.error }),
            };
        }

        // Build computed keys
        const keys = buildAllListingKeys({
            shop_listing_id,
            class_id: class_id ?? null,
            item_id,
            available_from,
            available_to,
            is_active,
        });

        const now = new Date().toISOString();

        const listing: ShopListing = {
            ...keys,
            shop_listing_id,
            item_id,
            available_from,
            available_to,
            is_active,
            ...(class_id !== undefined && class_id !== null ? { class_id } : {}),
            ...(purchase_limit_per_student !== undefined ? { purchase_limit_per_student } : {}),
            ...(created_by !== undefined ? { created_by } : {}),
            ...(display_order !== undefined ? { display_order } : {}),
            created_at: now,
            updated_at: now,
        };

        await createListing(listing);

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                shop_listing_id,
                message: "Shop listing created successfully",
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "A listing with this shop_listing_id, scope, and available_from already exists" }),
            };
        }

        console.error("Error creating shop listing:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

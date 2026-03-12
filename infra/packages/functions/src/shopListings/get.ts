import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getListingById } from "./repo.ts";

/**
 * GET /shop-listings/{shop_listing_id}
 *
 * Fetch one ShopListing by its listing ID.
 * Uses GSI3 (partitioned on shop_listing_id) for a direct, scan-free lookup.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const shop_listing_id = event.pathParameters?.shop_listing_id;

        if (!shop_listing_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing shop_listing_id in path" }),
            };
        }

        const listing = await getListingById(shop_listing_id);

        if (!listing) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Shop listing not found" }),
            };
        }

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(listing),
        };
    } catch (error: any) {
        console.error("Error getting shop listing:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

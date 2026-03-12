import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getListingById, setListingActiveStatus } from "./repo.ts";

/**
 * POST /shop-listings/{shop_listing_id}/activate
 *
 * Set is_active = true on a ShopListing.
 * Recomputes listing_status and GSI1PK.
 * PK, SK, and all other GSI keys are unaffected.
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

        // Fetch to get PK/SK (needed for the UpdateCommand key)
        const current = await getListingById(shop_listing_id);
        if (!current) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Shop listing not found" }),
            };
        }

        const now = new Date().toISOString();
        const updated = await setListingActiveStatus(current.PK, current.SK, current.class_id, true, now);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(updated),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Shop listing not found" }),
            };
        }

        console.error("Error activating shop listing:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

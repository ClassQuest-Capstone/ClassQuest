import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getListingById, updateListingInPlace, replaceListingRecord } from "./repo.ts";
import { buildAllListingKeys, buildGsi1Pk, buildGsi1Sk, buildGsi2Sk } from "./keys.ts";
import { validateShopListing } from "./validation.ts";
import type { ShopListing } from "./types.ts";

/**
 * PUT /shop-listings/{shop_listing_id}
 *
 * Update mutable fields on a ShopListing.
 * Immutable fields: shop_listing_id, item_id, created_at, created_by.
 *
 * When class_id or available_from changes, PK and/or SK must be rebuilt.
 * In that case, a TransactWrite atomically deletes the old record and puts the new one.
 *
 * When only available_to, purchase_limit_per_student, display_order, or is_active changes,
 * an in-place UpdateCommand is used.
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

        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const { class_id, available_from, available_to, is_active, purchase_limit_per_student, display_order } = body;

        // Reject if nothing was provided
        if (
            class_id === undefined &&
            available_from === undefined &&
            available_to === undefined &&
            is_active === undefined &&
            purchase_limit_per_student === undefined &&
            display_order === undefined
        ) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "No updatable fields provided" }),
            };
        }

        // Validate provided fields
        const validation = validateShopListing({
            class_id,
            available_from,
            available_to,
            is_active,
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

        // Fetch current record
        const current = await getListingById(shop_listing_id);
        if (!current) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Shop listing not found" }),
            };
        }

        const now = new Date().toISOString();

        // Merge values for cross-field validation
        const mergedAvailableFrom = available_from ?? current.available_from;
        const mergedAvailableTo   = available_to   ?? current.available_to;

        if (new Date(mergedAvailableTo) < new Date(mergedAvailableFrom)) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "available_to must be greater than or equal to available_from" }),
            };
        }

        // Determine whether PK or SK will change
        const newClassId        = class_id !== undefined ? (class_id ?? null) : current.class_id;
        const pkSkWillChange    = class_id !== undefined || available_from !== undefined;

        if (pkSkWillChange) {
            // Rebuild the full record and do a transactional delete + put
            const mergedIsActive = is_active !== undefined ? is_active : current.is_active;
            const keys = buildAllListingKeys({
                shop_listing_id: current.shop_listing_id,
                class_id:        newClassId,
                item_id:         current.item_id,
                available_from:  mergedAvailableFrom,
                available_to:    mergedAvailableTo,
                is_active:       mergedIsActive,
            });

            const newListing: ShopListing = {
                ...current,
                ...keys,
                available_from:  mergedAvailableFrom,
                available_to:    mergedAvailableTo,
                is_active:       mergedIsActive,
                updated_at:      now,
                ...(purchase_limit_per_student !== undefined
                    ? purchase_limit_per_student === null
                        ? { purchase_limit_per_student: undefined }
                        : { purchase_limit_per_student }
                    : {}),
                ...(display_order !== undefined
                    ? display_order === null
                        ? { display_order: undefined }
                        : { display_order }
                    : {}),
            };

            // Remove undefined values (for null-removal of optional fields)
            if (newClassId === null || newClassId === undefined) {
                delete (newListing as any).class_id;
            } else {
                newListing.class_id = newClassId as string;
            }
            if (newListing.purchase_limit_per_student === undefined) {
                delete newListing.purchase_limit_per_student;
            }
            if (newListing.display_order === undefined) {
                delete newListing.display_order;
            }

            await replaceListingRecord(current.PK, current.SK, newListing);

            return {
                statusCode: 200,
                headers: { "content-type": "application/json" },
                body: JSON.stringify(newListing),
            };
        }

        // In-place update (PK/SK unchanged)
        const inPlaceUpdates: Parameters<typeof updateListingInPlace>[2] = { updated_at: now };

        if (available_to !== undefined)              inPlaceUpdates.available_to = available_to;
        if (purchase_limit_per_student !== undefined) inPlaceUpdates.purchase_limit_per_student = purchase_limit_per_student;
        if (display_order !== undefined)              inPlaceUpdates.display_order = display_order;

        if (is_active !== undefined) {
            inPlaceUpdates.is_active      = is_active;
            inPlaceUpdates.listing_status = is_active ? "ACTIVE" : "INACTIVE";
            inPlaceUpdates.GSI1PK         = buildGsi1Pk(current.class_id, is_active);
        }

        // If available_to changed, GSI1SK must be rebuilt
        if (available_to !== undefined) {
            inPlaceUpdates.GSI1SK = buildGsi1Sk(
                current.available_from,
                available_to,
                current.item_id,
                current.shop_listing_id
            );
        }

        const updated = await updateListingInPlace(current.PK, current.SK, inPlaceUpdates);

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
        if (error.name === "TransactionCanceledException") {
            const reasons = (error.CancellationReasons ?? []) as any[];
            const duplicate = reasons.some((r: any) => r?.Code === "ConditionalCheckFailed" && reasons.indexOf(r) === 1);
            if (duplicate) {
                return {
                    statusCode: 409,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ error: "A listing with the new scope/available_from combination already exists" }),
                };
            }
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Shop listing not found or conflict during update" }),
            };
        }

        console.error("Error updating shop listing:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

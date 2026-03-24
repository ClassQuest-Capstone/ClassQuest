import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getItem, updateItem } from "./repo.ts";
import { buildItemKeys } from "./keys.ts";
import { validateShopItem } from "./validation.ts";

/**
 * PATCH /shop-items/{item_id}
 *
 * Update mutable fields on a ShopItem.
 *
 * If any GSI-key component (category, rarity, gold_cost, required_level) is
 * included in the request, this handler fetches the current item, merges the
 * new values, and recomputes all GSI keys before writing — ensuring the
 * GSI is always consistent.
 *
 * is_active is NOT updateable via this route. Use /activate or /deactivate instead.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const item_id = event.pathParameters?.item_id;

        if (!item_id) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "Missing item_id in path" }),
            };
        }

        // Step 1: Parse body
        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        // is_active is intentionally excluded — use /activate or /deactivate
        const {
            name,
            description,
            category,
            rarity,
            gold_cost,
            required_level,
            is_cosmetic_only,
            sprite_path,
            gender,
            asset_key,
        } = body;

        if (
            name === undefined &&
            description === undefined &&
            category === undefined &&
            rarity === undefined &&
            gold_cost === undefined &&
            required_level === undefined &&
            is_cosmetic_only === undefined &&
            sprite_path === undefined &&
            gender === undefined &&
            asset_key === undefined
        ) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "No updatable fields provided" }),
            };
        }

        // Step 2: Validate provided fields
        const validation = validateShopItem({
            name,
            description,
            category,
            rarity,
            gold_cost,
            required_level,
            is_cosmetic_only,
            sprite_path,
            gender,
            asset_key,
        });

        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: validation.error }),
            };
        }

        // Step 3: If any GSI key component is being updated, fetch the current
        // item to obtain the unchanged fields needed to recompute all GSI keys.
        const gsiKeyComponentsChanged =
            category !== undefined ||
            rarity    !== undefined ||
            gold_cost !== undefined ||
            required_level !== undefined;

        let gsiKeyUpdates: {
            gsi1pk: string;
            gsi1sk: string;
            gsi2pk: string;
            gsi2sk: string;
        } | undefined;

        if (gsiKeyComponentsChanged) {
            const current = await getItem(item_id);
            if (!current) {
                return {
                    statusCode: 404,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ error: "Shop item not found" }),
                };
            }

            const mergedCategory      = category      ?? current.category;
            const mergedRarity        = rarity        ?? current.rarity;
            const mergedGoldCost      = gold_cost     ?? current.gold_cost;
            const mergedRequiredLevel = required_level ?? current.required_level;

            try {
                gsiKeyUpdates = buildItemKeys(
                    item_id,
                    mergedCategory,
                    mergedRequiredLevel,
                    mergedGoldCost,
                    mergedRarity,
                    current.is_active   // active status is unchanged here
                );
            } catch (err: any) {
                return {
                    statusCode: 400,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ error: err.message }),
                };
            }
        }

        // Step 4: Write
        const now = new Date().toISOString();

        const updated = await updateItem(item_id, {
            name,
            description,
            category,
            rarity,
            gold_cost,
            required_level,
            is_cosmetic_only,
            sprite_path,
            gender,
            asset_key,
            ...(gsiKeyUpdates ?? {}),
            updated_at: now,
        });

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
                body: JSON.stringify({ error: "Shop item not found" }),
            };
        }

        console.error("Error updating shop item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

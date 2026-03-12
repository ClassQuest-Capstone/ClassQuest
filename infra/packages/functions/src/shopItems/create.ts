import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { ShopItem } from "./types.ts";
import { createItem } from "./repo.ts";
import { buildItemKeys } from "./keys.ts";
import { validateShopItem } from "./validation.ts";

/**
 * POST /shop-items
 *
 * Create a new ShopItem definition.
 * All GSI key fields are computed from the business fields — callers must
 * not supply gsi1pk, gsi1sk, gsi2pk, or gsi2sk directly.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        // Step 1: Parse body
        const rawBody = event.body;
        const body =
            typeof rawBody === "string" && rawBody.length
                ? JSON.parse(rawBody)
                : rawBody ?? {};

        const {
            item_id,
            name,
            description,
            category,
            rarity,
            gold_cost,
            required_level,
            is_cosmetic_only,
            sprite_path,
            is_active,
        } = body;

        // Step 2: Required-field check
        if (
            !item_id ||
            !name ||
            description === undefined ||
            !category ||
            !rarity ||
            gold_cost === undefined ||
            required_level === undefined ||
            is_cosmetic_only === undefined ||
            !sprite_path ||
            is_active === undefined
        ) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required fields",
                    required: [
                        "item_id",
                        "name",
                        "description",
                        "category",
                        "rarity",
                        "gold_cost",
                        "required_level",
                        "is_cosmetic_only",
                        "sprite_path",
                        "is_active",
                    ],
                }),
            };
        }

        // Step 3: Validation
        const validation = validateShopItem({
            item_id,
            name,
            description,
            category,
            rarity,
            gold_cost,
            required_level,
            is_cosmetic_only,
            sprite_path,
            is_active,
        });

        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: validation.error }),
            };
        }

        // Step 4: Build key fields
        let keys: ReturnType<typeof buildItemKeys>;
        try {
            keys = buildItemKeys(item_id, category, required_level, gold_cost, rarity, is_active);
        } catch (err: any) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: err.message }),
            };
        }

        // Step 5: Assemble and write item
        const now = new Date().toISOString();

        const item: ShopItem = {
            ...keys,
            item_id:          item_id.trim(),
            name:             name.trim(),
            description:      description.trim(),
            category:         category.trim(),
            rarity,
            gold_cost,
            required_level,
            is_cosmetic_only,
            sprite_path:      sprite_path.trim(),
            is_active,
            created_at: now,
            updated_at: now,
        };

        await createItem(item);

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                item_id,
                message: "Shop item created successfully",
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "A shop item with this item_id already exists" }),
            };
        }

        console.error("Error creating shop item:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

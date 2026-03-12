/**
 * DynamoDB key helpers for the ShopItems table.
 *
 * All composite sort-key segments use zero-padded numeric values so that
 * lexicographic ordering matches numeric ordering:
 *   required_level → 3 digits  (0–999)    e.g.   5 → "005"
 *   gold_cost      → 6 digits  (0–999999) e.g. 500 → "000500"
 *
 * Access patterns:
 *   List all active items      — GSI1: gsi1pk = "SHOP#ACTIVE"
 *   List active by category    — GSI1: gsi1pk = "SHOP#ACTIVE", gsi1sk begins_with "CATEGORY#{cat}#"
 *   List category (all states) — GSI2: gsi2pk = "CATEGORY#{cat}"
 *   Get one item               — PK:   item_pk = "SHOPITEM#{item_id}", item_sk = "META"
 */

// ── Primary key helpers ───────────────────────────────────────────────────────

export function makeItemPk(item_id: string): string {
    return `SHOPITEM#${item_id}`;
}

export function makeItemSk(): "META" {
    return "META";
}

// ── Padding helpers ───────────────────────────────────────────────────────────

/**
 * Zero-pad required_level to 3 digits.
 * Allows lexicographic sort to match numeric ascending order.
 *
 * @example
 * makeLevelPadded(0)   // "000"
 * makeLevelPadded(5)   // "005"
 * makeLevelPadded(100) // "100"
 */
export function makeLevelPadded(required_level: number): string {
    if (required_level < 0 || required_level > 999) {
        throw new Error("required_level must be between 0 and 999");
    }
    return String(required_level).padStart(3, "0");
}

/**
 * Zero-pad gold_cost to 6 digits.
 * Allows lexicographic sort to match numeric ascending order.
 *
 * @example
 * makePricePadded(0)      // "000000"
 * makePricePadded(500)    // "000500"
 * makePricePadded(99999)  // "099999"
 */
export function makePricePadded(gold_cost: number): string {
    if (gold_cost < 0 || gold_cost > 999999) {
        throw new Error("gold_cost must be between 0 and 999999");
    }
    return String(gold_cost).padStart(6, "0");
}

// ── GSI key helpers ───────────────────────────────────────────────────────────

/**
 * GSI1 partition key — encodes the active/inactive status.
 *
 * Sparse index: all items always have a gsi1pk value, so this is not
 * sparse by design — the two possible values act as two logical "buckets".
 */
export function makeGsi1Pk(is_active: boolean): string {
    return is_active ? "SHOP#ACTIVE" : "SHOP#INACTIVE";
}

/**
 * GSI1 sort key — enables efficient filtering by category, level, price, rarity.
 *
 * Format: CATEGORY#{cat}#LEVEL#{lv_3d}#PRICE#{price_6d}#RARITY#{rarity}#ITEM#{id}
 *
 * Query patterns supported:
 *   All active items in category   → begins_with("CATEGORY#{cat}#")
 *   Items up to a level            → BETWEEN "CATEGORY#{cat}#LEVEL#000" AND "CATEGORY#{cat}#LEVEL#{max_lv_padded}"
 */
export function makeGsi1Sk(
    category: string,
    required_level: number,
    gold_cost: number,
    rarity: string,
    item_id: string
): string {
    return [
        `CATEGORY#${category}`,
        `LEVEL#${makeLevelPadded(required_level)}`,
        `PRICE#${makePricePadded(gold_cost)}`,
        `RARITY#${rarity}`,
        `ITEM#${item_id}`,
    ].join("#");
}

/**
 * GSI2 partition key — partitions by category regardless of active status.
 * Useful for admin tooling or full-category browsing.
 */
export function makeGsi2Pk(category: string): string {
    return `CATEGORY#${category}`;
}

/**
 * GSI2 sort key — enables sorting by level then price within a category.
 *
 * Format: LEVEL#{lv_3d}#PRICE#{price_6d}#ITEM#{id}
 */
export function makeGsi2Sk(
    required_level: number,
    gold_cost: number,
    item_id: string
): string {
    return [
        `LEVEL#${makeLevelPadded(required_level)}`,
        `PRICE#${makePricePadded(gold_cost)}`,
        `ITEM#${item_id}`,
    ].join("#");
}

/**
 * Build the full set of computed key fields for a ShopItem.
 * Call this whenever creating a new item or updating any indexed field.
 */
export function buildItemKeys(
    item_id: string,
    category: string,
    required_level: number,
    gold_cost: number,
    rarity: string,
    is_active: boolean
): {
    item_pk: string;
    item_sk: "META";
    gsi1pk: string;
    gsi1sk: string;
    gsi2pk: string;
    gsi2sk: string;
} {
    return {
        item_pk: makeItemPk(item_id),
        item_sk: makeItemSk(),
        gsi1pk:  makeGsi1Pk(is_active),
        gsi1sk:  makeGsi1Sk(category, required_level, gold_cost, rarity, item_id),
        gsi2pk:  makeGsi2Pk(category),
        gsi2sk:  makeGsi2Sk(required_level, gold_cost, item_id),
    };
}

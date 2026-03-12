# ShopItems

## Overview

Global shop item **definitions** for ClassQuest. A ShopItem represents a purchasable cosmetic or
functional item available in the in-game shop. This table stores the catalogue — it is not
per-student inventory (purchases are tracked separately in a future PurchasedItems / Inventory table).

Each item is either **active** (visible to students in the shop) or **inactive** (hidden, used for
seasonal or retired items). Active/inactive state drives the GSI1 partition key, keeping active
listings scan-free.

---

## Table Schema

| Attribute        | Type   | Description                                    |
|------------------|--------|------------------------------------------------|
| `item_pk`        | String | **PK** — `SHOPITEM#{item_id}`                  |
| `item_sk`        | String | **SK** — always `"META"`                       |
| `item_id`        | String | Stable slug or UUID (e.g. `hat_iron_01`)       |
| `name`           | String | Display name (e.g. `Iron Helm`)                |
| `description`    | String | Flavour text                                   |
| `category`       | String | Uppercase category (e.g. `HAT`, `ARMOR_SET`)   |
| `rarity`         | String | `COMMON` · `UNCOMMON` · `RARE` · `EPIC` · `LEGENDARY` |
| `gold_cost`      | Number | Purchase price in gold (0–999 999)             |
| `required_level` | Number | Minimum player level to buy (0 = unrestricted) |
| `is_cosmetic_only` | Bool | `true` → visual only, no stat bonus           |
| `sprite_path`    | String | Relative asset path (e.g. `/items/hats/iron_helm.png`) |
| `is_active`      | Bool   | `false` → item hidden from shop                |
| `gsi1pk`         | String | GSI1 PK — `SHOP#ACTIVE` or `SHOP#INACTIVE`    |
| `gsi1sk`         | String | GSI1 SK — see below                           |
| `gsi2pk`         | String | GSI2 PK — `CATEGORY#{category}`               |
| `gsi2sk`         | String | GSI2 SK — see below                           |
| `created_at`     | String | ISO 8601 timestamp                             |
| `updated_at`     | String | ISO 8601 timestamp                             |

---

## GSI Design

### GSI1 — Active/Inactive browse index

| Key      | Value                                                                         |
|----------|-------------------------------------------------------------------------------|
| PK       | `SHOP#ACTIVE` or `SHOP#INACTIVE`                                              |
| SK       | `CATEGORY#{category}#LEVEL#{lv_3d}#PRICE#{price_6d}#RARITY#{rarity}#ITEM#{item_id}` |

**Why:**
- A single query on `gsi1pk = "SHOP#ACTIVE"` returns all items the shop should display.
- Adding a `begins_with(gsi1sk, "CATEGORY#HAT#")` filter scopes to one category.
- Numeric fields are zero-padded so lexicographic sort equals numeric sort:
  - `required_level` → 3 digits (e.g. `005`)
  - `gold_cost` → 6 digits (e.g. `000500`)
- Rarity is a tie-breaker after price.
- `ITEM#{item_id}` at the end guarantees uniqueness when two items share all other attributes.

### GSI2 — Category browse (admin / any-status)

| Key | Value                                           |
|-----|-------------------------------------------------|
| PK  | `CATEGORY#{category}`                           |
| SK  | `LEVEL#{lv_3d}#PRICE#{price_6d}#ITEM#{item_id}` |

**Why:**
- Allows browsing ALL items in a category regardless of active/inactive status.
- Useful for admin tools, item editors, or analytics without filtering by status.
- Sorted by level then price for consistent display.

---

## Access Patterns

| Pattern                              | Operation                          | Key                                      |
|--------------------------------------|------------------------------------|------------------------------------------|
| Get one item by ID                   | GetItem (primary)                  | `item_pk = SHOPITEM#{id}`, `item_sk = META` |
| List all active items                | Query GSI1                         | `gsi1pk = SHOP#ACTIVE`                  |
| List active items in a category      | Query GSI1 + begins_with           | `gsi1pk = SHOP#ACTIVE`, `gsi1sk begins_with CATEGORY#{cat}#` |
| List all items in category (any state) | Query GSI2                       | `gsi2pk = CATEGORY#{cat}`               |
| Filter by player level (≤ max level) | Application logic on query results | Compare `required_level ≤ player_level` |

---

## Routes

| Method | Path                               | Handler          | Description                        |
|--------|------------------------------------|------------------|------------------------------------|
| POST   | `/shop-items`                      | `create.ts`      | Create a new shop item definition  |
| GET    | `/shop-items/active`               | `list-active.ts` | List all active items              |
| GET    | `/shop-items/category/{category}`  | `list-by-category.ts` | List active items in a category |
| GET    | `/shop-items/{item_id}`            | `get.ts`         | Get one item by ID                 |
| PATCH  | `/shop-items/{item_id}`            | `update.ts`      | Update mutable fields              |
| PATCH  | `/shop-items/{item_id}/deactivate` | `deactivate.ts`  | Hide item from shop                |
| PATCH  | `/shop-items/{item_id}/activate`   | `activate.ts`    | Restore item to shop               |

### Query parameters (GET list endpoints)

| Param    | Default | Max | Description                        |
|----------|---------|-----|------------------------------------|
| `limit`  | `100`   | 500 | Items per page                     |
| `cursor` | —       | —   | Opaque base64 pagination token     |

---

## Key / Padding helpers (`keys.ts`)

| Function         | Input                                           | Output example                                              |
|------------------|-------------------------------------------------|-------------------------------------------------------------|
| `makeItemPk`     | `"hat_iron_01"`                                 | `"SHOPITEM#hat_iron_01"`                                    |
| `makeItemSk`     | —                                               | `"META"`                                                    |
| `makeLevelPadded`| `5`                                             | `"005"`                                                     |
| `makePricePadded`| `500`                                           | `"000500"`                                                  |
| `makeGsi1Pk`     | `true`                                          | `"SHOP#ACTIVE"`                                             |
| `makeGsi1Sk`     | `"HAT", 5, 500, "COMMON", "hat_iron_01"`        | `"CATEGORY#HAT#LEVEL#005#PRICE#000500#RARITY#COMMON#ITEM#hat_iron_01"` |
| `makeGsi2Pk`     | `"HAT"`                                         | `"CATEGORY#HAT"`                                            |
| `makeGsi2Sk`     | `5, 500, "hat_iron_01"`                         | `"LEVEL#005#PRICE#000500#ITEM#hat_iron_01"`                 |
| `buildItemKeys`  | `item_id, category, level, cost, rarity, active` | All six key fields                                         |

---

## Validation rules (`validation.ts`)

| Field             | Rules                                                              |
|-------------------|--------------------------------------------------------------------|
| `item_id`         | Non-empty string; only `[a-z0-9_-]`                               |
| `name`            | Non-empty string; ≤ 100 characters                                 |
| `description`     | String; ≤ 500 characters                                           |
| `category`        | Non-empty; only `[A-Z0-9_]` (e.g. `HAT`, `ARMOR_SET`)             |
| `rarity`          | One of `COMMON`, `UNCOMMON`, `RARE`, `EPIC`, `LEGENDARY`           |
| `gold_cost`       | Non-negative integer; 0–999 999                                    |
| `required_level`  | Non-negative integer; 0–999                                        |
| `is_cosmetic_only`| Boolean                                                            |
| `sprite_path`     | Non-empty string                                                   |

---

## Example record

```json
{
  "item_pk":          "SHOPITEM#hat_iron_01",
  "item_sk":          "META",
  "item_id":          "hat_iron_01",
  "name":             "Iron Helm",
  "description":      "Basic iron helmet for new adventurers.",
  "category":         "HAT",
  "rarity":           "COMMON",
  "gold_cost":        500,
  "required_level":   5,
  "is_cosmetic_only": false,
  "sprite_path":      "/items/hats/iron_helm.png",
  "is_active":        true,
  "gsi1pk":           "SHOP#ACTIVE",
  "gsi1sk":           "CATEGORY#HAT#LEVEL#005#PRICE#000500#RARITY#COMMON#ITEM#hat_iron_01",
  "gsi2pk":           "CATEGORY#HAT",
  "gsi2sk":           "LEVEL#005#PRICE#000500#ITEM#hat_iron_01",
  "created_at":       "2026-03-12T00:00:00.000Z",
  "updated_at":       "2026-03-12T00:00:00.000Z"
}
```

---

## Design notes

- **No scans**: all listing flows use GSI queries; `listActiveItems` and `listActiveByCategory` both
  hit GSI1, `listAllByCategory` hits GSI2.
- **GSI key consistency**: whenever `category`, `rarity`, `gold_cost`, or `required_level` changes,
  the `update` handler fetches the current item, merges values, and recomputes all six key fields
  before writing. The repo's `updateItem` accepts the pre-computed keys.
- **Activate/Deactivate symmetry**: only `is_active` and `gsi1pk` change on these operations —
  `gsi1sk`, `gsi2pk`, and `gsi2sk` are not affected by active state.
- **No purchase logic here**: this table is item definitions only. Player purchases and inventory
  are a separate concern (future `PurchasedItems` table).
- **item_id is caller-supplied**: teachers use human-readable slugs (`hat_iron_01`) rather than UUIDs
  for asset-pipeline consistency. The `ConditionalCheckFailedException` on create prevents duplicates.

---

## Testing

```bash
cd infra/packages/functions
npx vitest run src/shopItems/__tests__/shopItems.test.ts
```

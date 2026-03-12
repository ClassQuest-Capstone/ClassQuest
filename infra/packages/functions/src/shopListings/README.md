# ShopListings

## Purpose

`ShopListings` controls **where**, **when**, and **how** a `ShopItem` appears in the shop.
It is a scheduling and availability table — not an inventory or purchase table.

A listing links a shop item to a shop bucket (global or class-specific), defines a time window
(`available_from` / `available_to`), and carries a manual enable/disable flag (`is_active`).

**This table does not represent inventory ownership or purchases.**
Students purchasing an item is a separate concern (future `PurchasedItems` / `Inventory` table).

---

## Table Schema

| Attribute                    | Type    | Description                                                       |
|------------------------------|---------|-------------------------------------------------------------------|
| `PK`                         | String  | **PK** — `SHOP#GLOBAL` or `SHOP#CLASS#{class_id}`                |
| `SK`                         | String  | **SK** — `ACTIVEFROM#{available_from}#LISTING#{shop_listing_id}` |
| `shop_listing_id`            | String  | Caller-supplied unique listing ID (also GSI3 PK)                  |
| `item_id`                    | String  | References `ShopItem.item_id`                                     |
| `available_from`             | String  | ISO 8601 — window start                                           |
| `available_to`               | String  | ISO 8601 — window end                                             |
| `is_active`                  | Boolean | Manual enable/disable flag                                        |
| `listing_status`             | String  | Derived: `ACTIVE` \| `INACTIVE` (mirrors `is_active`)            |
| `class_id`                   | String? | Present for class-specific listings; absent for global            |
| `purchase_limit_per_student` | Number? | Max purchases per student (undefined = unlimited)                 |
| `created_by`                 | String? | Teacher/admin user ID                                             |
| `display_order`              | Number? | Optional display sort hint                                        |
| `GSI1PK`                     | String  | See GSI1 below                                                    |
| `GSI1SK`                     | String  | See GSI1 below                                                    |
| `GSI2PK`                     | String  | See GSI2 below                                                    |
| `GSI2SK`                     | String  | See GSI2 below                                                    |
| `created_at`                 | String  | ISO 8601                                                          |
| `updated_at`                 | String  | ISO 8601                                                          |

---

## PK / SK Format

### PK
| Scope           | Value                       |
|-----------------|-----------------------------|
| Global listing  | `SHOP#GLOBAL`               |
| Class listing   | `SHOP#CLASS#{class_id}`     |

### SK
```
ACTIVEFROM#{available_from}#LISTING#{shop_listing_id}
```
Lexicographic ordering within a bucket by activation time.

---

## GSI Design

### GSI1 — Shop bucket view (active/inactive)

| Key      | Value                                                                                      |
|----------|--------------------------------------------------------------------------------------------|
| GSI1PK   | `SHOPVIEW#GLOBAL#ACTIVE` \| `SHOPVIEW#GLOBAL#INACTIVE` \| `SHOPVIEW#CLASS#{class_id}#ACTIVE` \| `SHOPVIEW#CLASS#{class_id}#INACTIVE` |
| GSI1SK   | `FROM#{available_from}#TO#{available_to}#ITEM#{item_id}#LISTING#{shop_listing_id}`        |

**Why:**
- Single query returns all listings for a shop bucket.
- Active/inactive split avoids reading hidden items in the display path.
- Time window embedded in GSI1SK supports range queries (e.g. listings active after a date).

### GSI2 — Item-centric lookup

| Key    | Value                                                                            |
|--------|----------------------------------------------------------------------------------|
| GSI2PK | `ITEM#{item_id}`                                                                 |
| GSI2SK | `SHOP#GLOBAL#FROM#...#LISTING#...` \| `SHOP#CLASS#{class_id}#FROM#...#LISTING#...` |

**Why:**
- Find all listings for a given item across all scopes and active states.
- Useful for admin tooling, item-edit views, or analytics.

### GSI3 — Direct listing ID lookup

| Key    | Value               |
|--------|---------------------|
| GSI3PK | `shop_listing_id`   |

**Why:**
- The primary key (`PK` + `SK`) embeds class scope and time, making direct GetItem
  by listing ID alone impossible.
- GSI3 allows O(1) lookup by `shop_listing_id` without a scan.
- Used by `get`, `update`, `activate`, and `deactivate` handlers.

---

## Supported Access Patterns

| Pattern                              | Operation       | Key                                                 |
|--------------------------------------|-----------------|-----------------------------------------------------|
| Get one listing by ID                | Query GSI3      | `shop_listing_id = "{id}"`, limit 1                 |
| List active global listings          | Query GSI1      | `GSI1PK = "SHOPVIEW#GLOBAL#ACTIVE"`                |
| List inactive global listings        | Query GSI1      | `GSI1PK = "SHOPVIEW#GLOBAL#INACTIVE"`              |
| List active class listings           | Query GSI1      | `GSI1PK = "SHOPVIEW#CLASS#{class_id}#ACTIVE"`      |
| List inactive class listings         | Query GSI1      | `GSI1PK = "SHOPVIEW#CLASS#{class_id}#INACTIVE"`    |
| List all listings for one item       | Query GSI2      | `GSI2PK = "ITEM#{item_id}"`                        |
| Admin scan all listings              | Table Scan      | (admin only, not for display paths)                 |

---

## API

| Method | Path                                          | Handler               | Description                              |
|--------|-----------------------------------------------|-----------------------|------------------------------------------|
| POST   | `/shop-listings`                              | `create.ts`           | Create a new listing (global or class)   |
| GET    | `/shop-listings/{shop_listing_id}`            | `get.ts`              | Get one listing by ID                    |
| GET    | `/shop-listings`                              | `list-all.ts`         | Scan all listings (admin)                |
| GET    | `/shop-listings/active`                       | `list-active.ts`      | List active global listings              |
| GET    | `/shop-listings/global`                       | `list-global.ts`      | List global listings (active or inactive)|
| GET    | `/shop-listings/class/{class_id}`             | `list-by-class.ts`    | List listings for a class                |
| GET    | `/shop-listings/item/{item_id}`               | `list-by-item.ts`     | List all listings for an item            |
| PUT    | `/shop-listings/{shop_listing_id}`            | `update.ts`           | Update mutable fields                    |
| POST   | `/shop-listings/{shop_listing_id}/activate`   | `activate.ts`         | Set `is_active = true`                   |
| POST   | `/shop-listings/{shop_listing_id}/deactivate` | `deactivate.ts`       | Set `is_active = false`                  |

### Query parameters (list endpoints)

| Param        | Default | Max | Description                              |
|--------------|---------|-----|------------------------------------------|
| `limit`      | `100`   | 500 | Items per page                           |
| `cursor`     | —       | —   | Opaque base64 pagination token           |
| `active_only`| `"true"`| —   | `"false"` to retrieve inactive listings  |

---

## Example Records

### Global listing

```json
{
  "PK":                        "SHOP#GLOBAL",
  "SK":                        "ACTIVEFROM#2026-03-15T00:00:00Z#LISTING#listing_001",
  "shop_listing_id":           "listing_001",
  "item_id":                   "hat_iron_01",
  "available_from":            "2026-03-15T00:00:00Z",
  "available_to":              "2026-03-31T23:59:59Z",
  "purchase_limit_per_student": 1,
  "is_active":                 true,
  "listing_status":            "ACTIVE",
  "GSI1PK":                    "SHOPVIEW#GLOBAL#ACTIVE",
  "GSI1SK":                    "FROM#2026-03-15T00:00:00Z#TO#2026-03-31T23:59:59Z#ITEM#hat_iron_01#LISTING#listing_001",
  "GSI2PK":                    "ITEM#hat_iron_01",
  "GSI2SK":                    "SHOP#GLOBAL#FROM#2026-03-15T00:00:00Z#LISTING#listing_001",
  "created_at":                "2026-03-12T12:00:00Z",
  "updated_at":                "2026-03-12T12:00:00Z"
}
```

### Class listing

```json
{
  "PK":                        "SHOP#CLASS#class_123",
  "SK":                        "ACTIVEFROM#2026-04-01T00:00:00Z#LISTING#listing_002",
  "shop_listing_id":           "listing_002",
  "class_id":                  "class_123",
  "item_id":                   "pet_wisp_01",
  "available_from":            "2026-04-01T00:00:00Z",
  "available_to":              "2026-04-07T23:59:59Z",
  "purchase_limit_per_student": 2,
  "is_active":                 false,
  "listing_status":            "INACTIVE",
  "GSI1PK":                    "SHOPVIEW#CLASS#class_123#INACTIVE",
  "GSI1SK":                    "FROM#2026-04-01T00:00:00Z#TO#2026-04-07T23:59:59Z#ITEM#pet_wisp_01#LISTING#listing_002",
  "GSI2PK":                    "ITEM#pet_wisp_01",
  "GSI2SK":                    "SHOP#CLASS#class_123#FROM#2026-04-01T00:00:00Z#LISTING#listing_002",
  "created_at":                "2026-03-12T12:00:00Z",
  "updated_at":                "2026-03-12T12:00:00Z"
}
```

---

## Rebuilding Derived Keys During Updates

The `update` handler detects which key components have changed and takes one of two paths:

### In-place update (UpdateCommand)
Used when **only** `available_to`, `purchase_limit_per_student`, `display_order`, or `is_active` changes.
- PK and SK are unchanged.
- `is_active` change → `GSI1PK` and `listing_status` are recomputed in the same UpdateCommand.
- `available_to` change → `GSI1SK` is recomputed (GSI1SK embeds the `available_to` value).

### Replace record (TransactWrite: Delete + Put)
Used when **`class_id`** or **`available_from`** changes, because:
- `class_id` change → `PK`, `GSI1PK`, `GSI2SK` all change.
- `available_from` change → `SK`, `GSI1SK`, `GSI2SK` all change.

The handler uses `TransactWriteCommand` to atomically delete the old record and put the new one,
ensuring no orphaned records or partial states.

---

## Visibility Logic

A listing is **visible in the actual shop** only when ALL of the following are true:
1. `is_active = true`
2. `now >= available_from`
3. `now <= available_to`

GSI1 groups by manual active/inactive state. Final time-window filtering should be applied
in handler or frontend logic after the GSI1 query if current-visibility semantics are needed.

---

## What This Table Does NOT Do

- **No purchase logic** — does not record who bought what.
- **No inventory** — does not represent student item ownership.
- **No quantities** — `purchase_limit_per_student` is a per-student cap, not global stock.

---

## Testing

```bash
cd infra/packages/functions
npx vitest run src/shopListings/__tests__/shopListings.test.ts
```

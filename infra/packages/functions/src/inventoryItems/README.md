# InventoryItems

## Purpose

`InventoryItems` records **student item ownership** in ClassQuest.
One row exists per student + item combination and tracks how many of that item a student owns.

**This table stores ownership only.**
- Equipment state (is_equipped, slot, etc.) is stored in a separate equipment-state table.
- Shop listings and scheduling are managed by the `ShopListings` table.
- Purchase transactions and payment history are stored in a separate table.

---

## Table Schema

| Attribute           | Type   | Description                                                        |
|---------------------|--------|--------------------------------------------------------------------|
| `PK`                | String | **PK** — `STUDENT#{student_id}`                                   |
| `SK`                | String | **SK** — `ITEM#{item_id}`                                         |
| `inventory_item_id` | String | Stable server-generated record ID (not used as lookup key)         |
| `student_id`        | String | Owning student's ID                                                |
| `class_id`          | String | Class context for GSI1 lookups                                     |
| `item_id`           | String | References `ShopItem.item_id`                                      |
| `quantity`          | Number | Count owned (>= 1). Non-stackable items should stay at `1`.        |
| `acquired_from`     | String | `SHOP_PURCHASE` · `QUEST_REWARD` · `BOSS_REWARD` · `ADMIN_GRANT` · `SYSTEM_MIGRATION` |
| `acquired_at`       | String | ISO 8601 — first acquisition timestamp                             |
| `updated_at`        | String | ISO 8601 — last modification time                                  |
| `GSI1PK`            | String | `CLASS#{class_id}`                                                 |
| `GSI1SK`            | String | `STUDENT#{student_id}#ITEM#{item_id}`                              |
| `GSI2PK`            | String | `ITEM#{item_id}`                                                   |
| `GSI2SK`            | String | `CLASS#{class_id}#STUDENT#{student_id}`                            |

---

## PK / SK Format

| Key | Format               | Example                        |
|-----|----------------------|--------------------------------|
| PK  | `STUDENT#{student_id}` | `STUDENT#student_123`        |
| SK  | `ITEM#{item_id}`       | `ITEM#hat_iron_01`           |

Direct ownership check: `GetItem(PK = "STUDENT#s", SK = "ITEM#i")` — O(1).

---

## GSI Design

### GSI1 — Class-level inventory browse

| Key    | Value                                              |
|--------|----------------------------------------------------|
| GSI1PK | `CLASS#{class_id}`                                 |
| GSI1SK | `STUDENT#{student_id}#ITEM#{item_id}`              |

**Why:**
- Teachers can query all inventory records within a class.
- Adding `begins_with(GSI1SK, "STUDENT#{student_id}#")` scopes to a single student.
- Sorted by student then item for consistent display.

### GSI2 — Item-centric owner lookup

| Key    | Value                                   |
|--------|-----------------------------------------|
| GSI2PK | `ITEM#{item_id}`                        |
| GSI2SK | `CLASS#{class_id}#STUDENT#{student_id}` |

**Why:**
- Find all students who own a given item across all classes.
- Useful for admin analytics, item-based reward queries, and debugging.

---

## Supported Access Patterns

| Pattern                           | Operation        | Key                                                              |
|-----------------------------------|------------------|------------------------------------------------------------------|
| Check ownership (student + item)  | GetItem          | `PK = STUDENT#{s_id}`, `SK = ITEM#{i_id}`                       |
| List all items for a student      | Query PK         | `PK = STUDENT#{student_id}`                                      |
| List class inventory              | Query GSI1       | `GSI1PK = CLASS#{class_id}`                                      |
| List class inventory for student  | Query GSI1       | `GSI1PK = CLASS#{class_id}`, `begins_with(GSI1SK, STUDENT#{s}#)` |
| List all owners of one item       | Query GSI2       | `GSI2PK = ITEM#{item_id}`                                        |

---

## API

| Method | Path                                                | Handler                  | Description                         |
|--------|-----------------------------------------------------|--------------------------|-------------------------------------|
| POST   | `/inventory-items`                                  | `create.ts`              | Create ownership record             |
| GET    | `/inventory-items/{student_id}/{item_id}`           | `get.ts`                 | Get one record (direct lookup)      |
| GET    | `/inventory-items/student/{student_id}`             | `list-by-student.ts`     | List all items for a student        |
| GET    | `/inventory-items/class/{class_id}`                 | `list-by-class.ts`       | List class inventory                |
| GET    | `/inventory-items/class/{class_id}/student/{student_id}` | `list-by-class.ts`  | Class inventory filtered by student |
| GET    | `/inventory-items/item/{item_id}/owners`            | `list-by-item-owners.ts` | List all owners of an item          |
| PUT    | `/inventory-items/{student_id}/{item_id}`           | `update.ts`              | Update quantity / class_id          |
| DELETE | `/inventory-items/{student_id}/{item_id}`           | `delete.ts`              | Remove ownership record             |
| POST   | `/inventory-items/grant`                            | `grant.ts`               | Create-or-increment (teacher grant) |
| GET    | `/inventory-items/owns/{student_id}/{item_id}`      | `check-owns.ts`          | Ownership check with quantity       |

---

## Example Record

```json
{
  "PK":                "STUDENT#student_123",
  "SK":                "ITEM#hat_iron_01",
  "inventory_item_id": "a1b2c3d4-...",
  "student_id":        "student_123",
  "class_id":          "class_456",
  "item_id":           "hat_iron_01",
  "quantity":          1,
  "acquired_from":     "SHOP_PURCHASE",
  "acquired_at":       "2026-03-12T18:30:00Z",
  "updated_at":        "2026-03-12T18:30:00Z",
  "GSI1PK":            "CLASS#class_456",
  "GSI1SK":            "STUDENT#student_123#ITEM#hat_iron_01",
  "GSI2PK":            "ITEM#hat_iron_01",
  "GSI2SK":            "CLASS#class_456#STUDENT#student_123"
}
```

---

## Grant Behavior

`POST /inventory-items/grant` is the recommended endpoint for teacher/reward-grant flows:

1. Attempts `PutItem` with `attribute_not_exists(SK)` (creates new record, quantity = N).
2. If `ConditionalCheckFailedException` (student already owns item): falls back to an `ADD quantity :delta` UpdateCommand.

Use `POST /inventory-items` instead when strict uniqueness enforcement (409 on duplicate) is required.

---

## Quantity and Stackability

- `quantity >= 1` is always enforced.
- Non-stackable items should be granted with `quantity: 1` and not incremented further (enforced by calling convention, not schema).
- The schema does not yet distinguish stackable vs non-stackable items — that distinction lives in the `ShopItem` definition table. When item metadata is available, the grant handler can be extended to check stackability before incrementing.

---

## Updating class_id

If a student moves classes and `class_id` needs correction:
- `PUT /inventory-items/{student_id}/{item_id}` with `{ class_id: "new_class" }` is the correct path.
- The handler fetches the current record, rebuilds `GSI1PK`, `GSI1SK`, and `GSI2SK`, and applies them in the same UpdateCommand.
- `PK` and `SK` are never changed (they are based on `student_id` + `item_id`).

---

## What This Table Does NOT Do

- **No equipment state** — `is_equipped`, `equipped_at`, slot assignments, etc. belong in a separate equipment-state table.
- **No shop listings** — item availability and scheduling are in `ShopListings`.
- **No purchase transactions** — payment history is in a separate transactions table.

---

## Testing

```bash
cd infra/packages/functions
npx vitest run src/inventoryItems/__tests__/inventoryItems.test.ts
```

## StudentRewardClaims — API Reference

### Status Enum

| Value | Description |
|-------|-------------|
| `AVAILABLE` | Student has reached the required level; reward can be claimed |
| `CLAIMED` | Student has claimed the reward |

### reward_target_type Enum

`ITEM` · `AVATAR_TIER` · `BACKGROUND` · `PET` · `BADGE` · `CUSTOM`

---

## 1. Create Student Reward Claim (Internal)

**POST** `/internal/student-reward-claims`

Creates a claim row. Primarily for internal use and testing. Use `level-up-sync` for automatic creation during level-ups.

**Request Body:**
```json
{
  "student_id": "student_123",
  "class_id": "class_123",
  "reward_id": "reward_helmet_lvl5",
  "status": "AVAILABLE",
  "unlocked_at_level": 5,
  "reward_target_type": "ITEM",
  "reward_target_id": "item_rare_helmet_01"
}
```

**Response 201:**
```json
{
  "student_reward_claim_id": "uuid",
  "student_id": "student_123",
  "class_id": "class_123",
  "reward_id": "reward_helmet_lvl5",
  "status": "AVAILABLE",
  "unlocked_at_level": 5,
  "claim_sort": "AVAILABLE#class_123#00005#reward_helmet_lvl5",
  "unlocked_at": "2026-03-08T00:00:00.000Z",
  "reward_target_type": "ITEM",
  "reward_target_id": "item_rare_helmet_01",
  "created_at": "2026-03-08T00:00:00.000Z",
  "updated_at": "2026-03-08T00:00:00.000Z"
}
```

**Response 409:** `CLAIM_ALREADY_EXISTS` — a claim already exists for this student + reward.

**Response 400:** `VALIDATION_FAILED` — with `details` array of `{ field, message }`.

---

## 2. Get Student Reward Claim (Internal)

**GET** `/internal/student-reward-claims/{claim_id}`

**Response 200:** Full claim item.

**Response 404:** `CLAIM_NOT_FOUND`

---

## 3. List Claims for Student in Class

**GET** `/student/classes/{class_id}/reward-claims`

**Query Params:**
- `student_id` (required until auth) — student whose claims to return
- `status` (optional) — filter by `AVAILABLE` or `CLAIMED`

**Response 200:**
```json
{
  "items": [
    {
      "student_reward_claim_id": "uuid",
      "student_id": "student_123",
      "class_id": "class_123",
      "reward_id": "reward_helmet_lvl5",
      "status": "AVAILABLE",
      "unlocked_at_level": 5,
      "claim_sort": "AVAILABLE#class_123#00005#reward_helmet_lvl5",
      "unlocked_at": "2026-03-08T00:00:00.000Z",
      "claimed_at": null,
      "created_at": "2026-03-08T00:00:00.000Z",
      "updated_at": "2026-03-08T00:00:00.000Z"
    }
  ]
}
```

---

## 4. List Claims for Student (Internal)

**GET** `/internal/students/{student_id}/reward-claims`

**Query Params:**
- `class_id` (optional) — filter to a specific class
- `status` (optional) — filter by `AVAILABLE` or `CLAIMED`

**Response 200:** `{ items: [...] }`

---

## 5. Claim a Reward

**POST** `/student/rewards/{reward_id}/claim`

Transitions an AVAILABLE claim to CLAIMED. Only AVAILABLE → CLAIMED is allowed.

**Request Body:**
```json
{
  "student_id": "student_123",
  "class_id": "class_123"
}
```

**Response 200:**
```json
{
  "message": "Reward claimed successfully",
  "reward_id": "reward_helmet_lvl5",
  "student_id": "student_123",
  "status": "CLAIMED",
  "claimed_at": "2026-03-08T00:01:00.000Z"
}
```

**Response 404:** `CLAIM_NOT_FOUND` — student has not reached the level yet (no claim row exists).

**Response 409:** `ALREADY_CLAIMED` — reward was already claimed.

---

## 6. Level-Up Sync (Internal)

**POST** `/internal/students/{student_id}/reward-claims/level-up-sync`

Creates AVAILABLE claim rows for all reward milestones newly crossed when a student's level increases.

**Request Body:**
```json
{
  "class_id": "class_123",
  "old_level": 4,
  "new_level": 7
}
```

**Behavior:**
- Finds all active, non-deleted milestones where `old_level < unlock_level <= new_level`
- Skips milestones where a claim row already exists (idempotent)
- Creates AVAILABLE claim rows for newly crossed milestones

**Response 200:**
```json
{
  "student_id": "student_123",
  "class_id": "class_123",
  "old_level": 4,
  "new_level": 7,
  "created_count": 2,
  "created_claims": [ { /* claim item */ }, { /* claim item */ } ]
}
```

**No-op response (new_level <= old_level):**
```json
{
  "student_id": "student_123",
  "class_id": "class_123",
  "old_level": 7,
  "new_level": 7,
  "created_count": 0,
  "created_claims": [],
  "message": "No level increase — no claims created"
}
```

---

## 7. Get Rewards State for Class

**GET** `/student/classes/{class_id}/rewards-state`

Returns merged LOCKED / AVAILABLE / CLAIMED state for all active rewards in a class.

**Query Params:**
- `student_id` (required until auth)

**State Rules:**
- `CLAIMED` — claim row exists with `status=CLAIMED`
- `AVAILABLE` — claim row exists with `status=AVAILABLE`
- `AVAILABLE` — no claim row but `student_level >= unlock_level`
- `LOCKED` — no claim row and `student_level < unlock_level`

**Response 200:**
```json
{
  "class_id": "class_123",
  "student_id": "student_123",
  "student_level": 5,
  "rewards": [
    {
      "reward_id": "reward_helmet_lvl5",
      "title": "Rare Helmet",
      "description": "Unlock a rare helmet for your avatar",
      "unlock_level": 5,
      "type": "HELMET",
      "image_asset_path": "assets/helmet_rare.png",
      "state": "AVAILABLE",
      "claimed_at": null,
      "unlocked_at": "2026-03-08T00:00:00.000Z"
    },
    {
      "reward_id": "reward_armor_lvl10",
      "title": "Rare Armor Set",
      "description": "Unlock a rare armor set for your avatar",
      "unlock_level": 10,
      "type": "ARMOR_SET",
      "image_asset_path": null,
      "state": "LOCKED",
      "claimed_at": null,
      "unlocked_at": null
    }
  ]
}
```

---

## Validation Rules

### Required fields for POST /internal/student-reward-claims

| Field | Rule |
|-------|------|
| student_id | non-empty string |
| class_id | non-empty string |
| reward_id | non-empty string |
| status | must be `AVAILABLE` or `CLAIMED` |
| unlocked_at_level | integer >= 1 |
| reward_target_type | must be valid enum value |
| reward_target_id | non-empty string |

### Validation Errors Format

```json
{
  "error": "VALIDATION_FAILED",
  "details": [
    { "field": "status", "message": "must be one of: AVAILABLE, CLAIMED" },
    { "field": "unlocked_at_level", "message": "must be an integer >= 1" }
  ]
}
```

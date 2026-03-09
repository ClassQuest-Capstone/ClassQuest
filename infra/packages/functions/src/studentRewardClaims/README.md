## StudentRewardClaims

## Overview

`StudentRewardClaims` tracks the per-student state of each reward milestone. When a student reaches the required level for a reward, a claim row is created with status `AVAILABLE`. The student can then claim it, transitioning the row to `CLAIMED`.

This table is separate from `RewardMilestones` (which stores the teacher-defined reward rules) because reward state is per-student, while the milestone definition is shared across all students in a class.

## Relationship to Other Tables

| Table | Relationship |
|-------|-------------|
| **RewardMilestones** | Each claim row references one milestone via `reward_id`. Milestones define what the reward is and at what level it unlocks. |
| **PlayerStates** | Used to derive the student's current level (`floor(total_xp_earned / 100) + 1`). Level-up sync reads this to decide which milestones to create claims for. |

## Status Lifecycle

```
(student reaches unlock_level)
        ↓
    AVAILABLE   ←── level-up-sync creates claim row
        ↓
    CLAIMED     ←── student clicks Claim in UI
```

A claim row is **never deleted** — only transitioned to `CLAIMED`.

## Table Schema

**Table Name:** `StudentRewardClaims`

### Primary Key
- **student_reward_claim_id** (string): UUID

### GSI1: student_id + claim_sort
- **PK:** student_id
- **SK:** claim_sort — `"{status}#{class_id}#{level_5d}#{reward_id}"`
- **Purpose:** List all rewards for one student, sorted by status/class/level

### GSI2: reward_id + student_id
- **PK:** reward_id
- **SK:** student_id
- **Purpose:** Duplicate prevention — check whether a student already has a row for a given reward

### claim_sort Format

```
AVAILABLE#class_123#00005#reward_helmet_lvl5
CLAIMED#class_123#00005#reward_helmet_lvl5
```

Zero-padded 5-digit level ensures correct numeric sort order.

## Main APIs

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/internal/student-reward-claims` | Create a claim row (internal/testing) |
| GET | `/internal/student-reward-claims/{claim_id}` | Get one claim by ID |
| GET | `/internal/students/{student_id}/reward-claims` | List all claims for a student (internal) |
| POST | `/internal/students/{student_id}/reward-claims/level-up-sync` | Create AVAILABLE claims for newly crossed levels |
| GET | `/student/classes/{class_id}/reward-claims` | List claims for authenticated student in a class |
| POST | `/student/rewards/{reward_id}/claim` | Claim an AVAILABLE reward |
| GET | `/student/classes/{class_id}/rewards-state` | Merged LOCKED/AVAILABLE/CLAIMED state for UI |

## Future TODO

- Wire actual inventory/badge grant in `claim-reward.ts` when `InventoryItems` or similar table is implemented. See `// TODO: grant actual inventory item` comment in that file.
- Replace `student_id` query param with JWT claim once auth is implemented.
- Add class ownership verification for teacher-initiated routes.

---

**Last Updated:** 2026-03-08
**Feature:** Student Reward Claims

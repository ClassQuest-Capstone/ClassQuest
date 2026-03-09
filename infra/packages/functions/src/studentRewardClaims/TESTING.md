## StudentRewardClaims — Testing

## How to Run Tests

```bash
cd infra/packages/functions/src/studentRewardClaims

# Sort key helper tests
node --import tsx keys.test.ts

# Validation tests
node --import tsx validation.test.ts
```

## Test Files

### keys.test.ts — Sort Key Helper Tests

Tests the `buildClaimSort` function that generates the GSI1 sort key.

| Test | What It Covers |
|------|---------------|
| AVAILABLE sort key format | `AVAILABLE#class_123#00005#reward_helmet_lvl5` |
| CLAIMED sort key format | `CLAIMED#class_123#00005#reward_helmet_lvl5` |
| Level zero-padding (10) | `00010` — 5 digits |
| Level 1 (minimum) | `00001` |
| Level 100 (high) | `00100` |
| AVAILABLE before CLAIMED | Lexicographic ordering |
| Lower level before higher | Numeric ordering via zero-padding |
| Reward ID tiebreaker | Same status/class/level still sorts stably |

### validation.test.ts — Input Validation Tests

Tests `validateCreateInput` for all required fields and type checks.

| Test | Edge Case Covered |
|------|------------------|
| Valid input passes | All required fields present and valid |
| CLAIMED status accepted | Both AVAILABLE and CLAIMED are valid |
| Empty student_id | Required field enforcement |
| Undefined class_id | Required field enforcement |
| Null reward_id | Required field enforcement |
| Invalid status PENDING | Enum validation |
| unlocked_at_level = 0 | Minimum value (must be >= 1) |
| unlocked_at_level = -1 | Negative rejected |
| unlocked_at_level = 2.5 | Non-integer rejected |
| Invalid reward_target_type SWORD | Enum validation |
| Empty reward_target_id | Required field enforcement |
| Multiple missing fields | All errors returned (not fail-fast) |
| All valid reward_target_type values | ITEM, AVATAR_TIER, BACKGROUND, PET, BADGE, CUSTOM |

## Business Logic Covered (Unit Tested via Handlers)

The following business logic paths are covered by the handler implementations:

| Scenario | Handler | Behavior |
|----------|---------|----------|
| Duplicate prevention (create) | `create.ts` | GSI2 check before write; 409 if exists |
| AVAILABLE → CLAIMED only | `claim-reward.ts` | 409 if already CLAIMED |
| Race condition on claim | `claim-reward.ts` | ConditionalCheckFailedException → 409 |
| Level-up sync idempotency | `level-up-sync.ts` | Skips existing claim rows |
| Level-up sync range filter | `level-up-sync.ts` | Only `old_level < unlock_level <= new_level` |
| No-op when level did not increase | `level-up-sync.ts` | Returns `created_count: 0` immediately |
| LOCKED state (below level) | `rewards-state.ts` | `student_level < unlock_level` → LOCKED |
| AVAILABLE state (at level, no claim) | `rewards-state.ts` | `student_level >= unlock_level` → AVAILABLE |
| AVAILABLE state (claim exists) | `rewards-state.ts` | Claim with AVAILABLE → AVAILABLE |
| CLAIMED state | `rewards-state.ts` | Claim with CLAIMED → CLAIMED |

## Notes

- DynamoDB integration tests require a live DynamoDB table (local or AWS).
- Repository functions rely on `STUDENT_REWARD_CLAIMS_TABLE_NAME`, `REWARD_MILESTONES_TABLE_NAME`, and `PLAYER_STATES_TABLE_NAME` environment variables.
- The conditional update in `updateStudentRewardClaimStatus` (status must equal AVAILABLE) is the database-level guard against double-claiming.

# QuestQuestionResponses Reward Linkage Implementation Summary

## Overview
Implemented reward linkage and summary fields for QuestQuestionResponses to enable the future reward pipeline. This includes status tracking, attempt counters, reward totals, and transaction linkage without implementing the actual reward application to PlayerStates.

## Files Changed

### Backend - Type Definitions & Validation

#### 1. `infra/packages/functions/src/questQuestionResponses/types.ts`
**Added new enums:**
- `ResponseStatus` - NOT_STARTED, IN_PROGRESS, SUBMITTED, NEEDS_REVIEW, INCORRECT, CORRECT, GRADED
- `RewardStatus` - PENDING, APPLIED, REVERSED

**Extended `QuestQuestionResponseItem` with:**
- `attempt_count: number` - Total attempts (default: 0)
- `wrong_attempt_count: number` - Wrong attempts (default: 0)
- `status: ResponseStatus` - Response status (default: derived)
- `xp_awarded_total: number` - Total XP awarded (default: 0)
- `gold_awarded_total: number` - Total gold awarded (default: 0)
- `reward_txn_id?: string` - Link to RewardTransactions (optional)
- `reward_status?: RewardStatus` - Reward application status (optional)

**Added helper functions:**
- `deriveResponseStatus(item)` - Derives status from answer/grading state
- `deriveRewardStatus(item)` - Derives reward status from reward fields
- `normalizeResponseItem(item)` - Applies defaults for backward compatibility

#### 2. `infra/packages/functions/src/questQuestionResponses/validation.ts` (NEW FILE)
**Created comprehensive validation:**
- `validateStatus()` - Validates ResponseStatus enum
- `validateRewardStatus()` - Validates RewardStatus enum
- `validateNonNegative()` - Validates numeric fields >= 0
- `validateRewardTxnId()` - Validates reward_txn_id is non-empty string
- `validateSummaryAndRewardFields()` - Validates all new fields together

### Backend - Repository Updates

#### 3. `infra/packages/functions/src/questQuestionResponses/repo.ts`
**Updated `gradeResponse()` function:**
- Added parameters: `status`, `xp_awarded_total`, `gold_awarded_total`, `reward_status`
- Supports updating reward totals when grading

**Added new functions:**
- `markRewardApplied()` - Sets reward_txn_id, reward_status=APPLIED, and totals (idempotent)
- `markRewardReversed()` - Sets reward_status=REVERSED (validates txn_id match)

### Backend - Handler Updates

#### 4. `infra/packages/functions/src/questQuestionResponses/upsert-response.ts`
**Changes:**
- Import validation functions
- Set `status` to SUBMITTED by default (or IN_PROGRESS if provided)
- Initialize counters: `attempt_count=0`, `wrong_attempt_count=0`
- Initialize reward fields: `xp_awarded_total=0`, `gold_awarded_total=0`
- **Restriction:** Students CANNOT set reward fields (reward_txn_id, reward_status)

#### 5. `infra/packages/functions/src/questQuestionResponses/grade-response.ts`
**Changes:**
- Import validation and new types
- Accept optional `xp_awarded_total`, `gold_awarded_total`, `status` in request
- Set `status` to GRADED automatically when grading
- Set `reward_status` to PENDING if rewards > 0 and no txn_id
- **Note:** Teachers can optionally provide reward totals when grading

#### 6. `infra/packages/functions/src/questQuestionResponses/get-by-instance-and-student.ts`
**Changes:**
- Import `normalizeResponseItem`
- Apply normalization to all responses before returning
- **Ensures backward compatibility** with old records

#### 7. `infra/packages/functions/src/questQuestionResponses/list-by-instance.ts`
**Changes:**
- Import `normalizeResponseItem`
- Apply normalization to all responses before returning

#### 8. `infra/packages/functions/src/questQuestionResponses/list-by-student.ts`
**Changes:**
- Import `normalizeResponseItem`
- Apply normalization to all responses before returning

#### 9. `infra/packages/functions/src/questQuestionResponses/list-by-question.ts`
**Changes:**
- Import `normalizeResponseItem`
- Apply normalization to all responses before returning

### Backend - New Internal Routes

#### 10. `infra/packages/functions/src/questQuestionResponses/mark-reward-applied.ts` (NEW FILE)
**Internal route for reward pipeline:**
- **Path:** `POST /internal/quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/reward-applied`
- **Auth:** Should be restricted to service account or admin only
- **Input:** `reward_txn_id`, `xp_awarded_total`, `gold_awarded_total`
- **Behavior:** Sets reward_txn_id, reward_status=APPLIED, ensures idempotency
- **Returns:** 200 OK or 409 Conflict if already applied

#### 11. `infra/packages/functions/src/questQuestionResponses/mark-reward-reversed.ts` (NEW FILE)
**Internal route for reward pipeline:**
- **Path:** `POST /internal/quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/reward-reversed`
- **Auth:** Should be restricted to service account or admin only
- **Input:** `reward_txn_id`
- **Behavior:** Sets reward_status=REVERSED (validates txn_id match)
- **Returns:** 200 OK or 404 Not Found if txn_id mismatch

### Frontend - API Client

#### 12. `app/frontend/src/api/questQuestionResponses.ts`
**Updated types:**
- Added `ResponseStatus` enum type
- Added `RewardStatus` enum type
- Extended `QuestQuestionResponse` with all new fields:
  - `attempt_count`, `wrong_attempt_count`, `status`
  - `xp_awarded_total`, `gold_awarded_total`
  - `reward_txn_id?`, `reward_status?`

**Updated `GradeResponseRequest`:**
- Added optional fields: `status`, `xp_awarded_total`, `gold_awarded_total`
- Teachers can now provide reward totals when grading (if UI supports it)

## Defaults & Derivation Rules

### Write-Time Defaults (upsert/grade)
When creating or updating responses:
- `attempt_count`: 0 (students cannot set directly)
- `wrong_attempt_count`: 0
- `status`: SUBMITTED (on upsert) or GRADED (on grade)
- `xp_awarded_total`: 0 (only teachers/graders can set)
- `gold_awarded_total`: 0 (only teachers/graders can set)
- `reward_txn_id`: undefined (only internal routes can set)
- `reward_status`: undefined or PENDING if rewards > 0

### Read-Time Normalization (get/list)
Old records without new fields get defaults applied via `normalizeResponseItem()`:
- `attempt_count`: 0
- `wrong_attempt_count`: 0
- `status`: Derived via `deriveResponseStatus()`:
  - No answer → NOT_STARTED
  - Answer exists but not submitted → IN_PROGRESS
  - Teacher graded → GRADED
  - Auto-graded with points > 0 → CORRECT
  - Auto-graded with points = 0 → INCORRECT
  - Submitted but not auto-gradable → NEEDS_REVIEW
- `xp_awarded_total`: 0
- `gold_awarded_total`: 0
- `reward_status`: Derived via `deriveRewardStatus()`:
  - Has reward_txn_id → APPLIED
  - Has rewards but no txn_id → PENDING
  - No rewards → undefined

## Validation Rules

### Write Restrictions
1. **Students (upsert route):**
   - ✅ Can set: `status` (SUBMITTED or IN_PROGRESS)
   - ✅ Can set: `attempt_count`, `wrong_attempt_count` (if provided)
   - ❌ CANNOT set: `xp_awarded_total`, `gold_awarded_total`, `reward_txn_id`, `reward_status`

2. **Teachers (grade route):**
   - ✅ Can set: `status` (defaults to GRADED)
   - ✅ Can set: `xp_awarded_total`, `gold_awarded_total` (optional)
   - ❌ CANNOT set: `reward_txn_id`, `reward_status` (only internal routes)

3. **Internal Routes:**
   - ✅ Can set: `reward_txn_id`, `reward_status`, `xp_awarded_total`, `gold_awarded_total`
   - 🔒 Should be restricted to service accounts/admin only

### Field Constraints
- All numeric fields must be >= 0
- `status` must be valid ResponseStatus enum value
- `reward_status` must be valid RewardStatus enum value
- `reward_txn_id` must be non-empty string if provided

## Backward Compatibility

✅ **No breaking changes:**
- Old responses without new fields work immediately
- Read-time normalization applies defaults automatically
- All existing API endpoints continue working
- Frontend receives all fields for all responses (old and new)

✅ **No data migration needed:**
- `normalizeResponseItem()` handles old records on-the-fly
- Defaults are applied consistently at read-time
- Write operations update records with new fields when modified

## API Contract Changes

### Updated Responses - All GET/LIST Endpoints
All list/get responses now include:
```json
{
  "attempt_count": 0,
  "wrong_attempt_count": 0,
  "status": "GRADED",
  "xp_awarded_total": 100,
  "gold_awarded_total": 50,
  "reward_txn_id": "txn_abc123",
  "reward_status": "APPLIED"
}
```

### Updated - PUT /quest-instances/{id}/questions/{id}/responses/{id}
**Optional new fields (students can set):**
```json
{
  "status": "SUBMITTED",
  "attempt_count": 1,
  "wrong_attempt_count": 0
}
```

### Updated - PATCH /quest-instances/{id}/questions/{id}/responses/{id}/grade
**Optional new fields (teachers can set):**
```json
{
  "status": "GRADED",
  "xp_awarded_total": 100,
  "gold_awarded_total": 50
}
```

### New - POST /internal/.../reward-applied
**Internal route (service account only):**
```json
{
  "reward_txn_id": "txn_abc123",
  "xp_awarded_total": 100,
  "gold_awarded_total": 50
}
```

### New - POST /internal/.../reward-reversed
**Internal route (service account only):**
```json
{
  "reward_txn_id": "txn_abc123"
}
```

## Status Derivation Flow

```
1. No answer exists
   → NOT_STARTED

2. Answer exists, not submitted
   → IN_PROGRESS

3. Submitted, auto-gradable, auto_points_awarded set
   → CORRECT (points > 0) or INCORRECT (points = 0)

4. Submitted, not auto-gradable
   → NEEDS_REVIEW

5. Teacher graded (teacher_points_awarded set)
   → GRADED

6. Explicitly set via API
   → Use provided status
```

## Reward Status Flow

```
1. No rewards set (xp=0, gold=0)
   → undefined (not eligible)

2. Rewards set but no reward_txn_id
   → PENDING

3. reward_txn_id present
   → APPLIED

4. Explicitly reversed via internal route
   → REVERSED
```

## Next Steps (Out of Scope)

This implementation provides the foundation for:
1. **QuestAnswerAttempts table** - Track individual wrong answer attempts
2. **Reward calculation pipeline** - Compute rewards based on QuestQuestions config
3. **Reward application** - Apply rewards to PlayerStates via RewardTransactions
4. **UI updates** - Display XP/gold rewards in teacher grading interface

## Testing Recommendations

1. **Upsert response** - verify status defaults to SUBMITTED
2. **Grade response without rewards** - verify status = GRADED
3. **Grade response with rewards** - verify reward_status = PENDING
4. **List old responses** - verify defaults applied
5. **Mark reward applied (internal)** - verify idempotency
6. **Mark reward reversed (internal)** - verify txn_id validation
7. **Test status derivation** for all scenarios
8. **Test reward status derivation** for all scenarios

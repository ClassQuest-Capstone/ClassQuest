# Reward Configuration Implementation Summary

## Overview
Implemented end-to-end reward configuration for QuestQuestions, enabling XP and gold rewards with optional decay per wrong attempt. SHORT_ANSWER and ESSAY question types are decay-exempt by default.

## Files Changed

### Backend - Type Definitions & Validation

#### 1. `infra/packages/functions/src/questQuestions/types.ts`
**Added reward config fields to `QuestQuestionItem`:**
- `base_xp: number` - Base XP reward (required, default: 0)
- `min_xp: number` - Minimum XP after decay (default: 0)
- `xp_decay_per_wrong: number` - XP decay per wrong attempt (default: 0)
- `base_gold: number` - Base gold reward (default: 0)
- `min_gold: number` - Minimum gold after decay (default: 0)
- `gold_decay_per_wrong: number` - Gold decay per wrong attempt (default: 0)
- `decay_exempt: boolean` - True for SHORT_ANSWER/ESSAY (default: derived from format)

**Updated `UpdateQuestionInput` type:**
- Added all 7 reward config fields as optional partial updates

**Added helper functions:**
- `isDecayExempt(question_format)` - Determines if format is SHORT_ANSWER or ESSAY
- `applyRewardDefaults(item)` - Applies defaults for backward compatibility with old records

#### 2. `infra/packages/functions/src/questQuestions/validation.ts`
**Added `validateRewardConfig()` function:**
- Validates all reward fields are non-negative numbers
- Enforces `min_xp <= base_xp` constraint
- Enforces `min_gold <= base_gold` constraint
- Returns structured validation result with error messages

**Updated `validateQuestion()` function:**
- Added reward config fields to function signature
- Calls `validateRewardConfig()` during validation
- Ensures all reward constraints are checked before question creation/update

### Backend - Handlers

#### 3. `infra/packages/functions/src/questQuestions/create.ts`
**Changes:**
- Import `isDecayExempt` helper
- Extract reward config fields from request body
- Pass reward fields to `validateQuestion()`
- Apply defaults when creating question item:
  - All numeric fields default to 0 if not provided
  - `decay_exempt` defaults to result of `isDecayExempt(question_format)` if not explicitly provided
- Store all reward config fields in DynamoDB

#### 4. `infra/packages/functions/src/questQuestions/update.ts`
**Changes:**
- Import `isDecayExempt` helper
- Extract reward config fields from request body
- Include reward fields in merged validation data with fallback to existing values
- Auto-derive `decay_exempt` when `question_format` changes (unless explicitly provided)
- Add all reward fields to updates object when provided
- Validation ensures constraints are met even when partially updating

#### 5. `infra/packages/functions/src/questQuestions/repo.ts`
**Updated `updateQuestion()` function:**
- Added all 7 reward config fields to function signature
- Added DynamoDB update expressions for each reward field
- Properly maps fields to attribute names and values

#### 6. `infra/packages/functions/src/questQuestions/get.ts`
**Changes:**
- Import `applyRewardDefaults` helper
- Apply defaults to question item before returning
- **Ensures backward compatibility:** Old questions without reward fields get defaults applied at read-time

#### 7. `infra/packages/functions/src/questQuestions/list-by-template.ts`
**Changes:**
- Import `applyRewardDefaults` helper
- Map all returned items through `applyRewardDefaults()`
- **Ensures backward compatibility:** Old questions in lists get defaults applied at read-time

### Frontend - API Client

#### 8. `app/frontend/src/api/questQuestions.ts`
**Updated `QuestQuestion` type:**
- Added all 7 reward config fields as required properties
- Fields are typed as `number` (for numeric fields) and `boolean` (for decay_exempt)
- Frontend can now send and receive reward config in all API calls

## Defaults Applied

### Server-Side Write Defaults (create/update)
When creating or updating questions, if reward fields are omitted:
- `base_xp`: 0
- `min_xp`: 0
- `xp_decay_per_wrong`: 0
- `base_gold`: 0
- `min_gold`: 0
- `gold_decay_per_wrong`: 0
- `decay_exempt`: `isDecayExempt(question_format)` (true for SHORT_ANSWER/ESSAY, false otherwise)

### Server-Side Read Defaults (get/list)
When reading questions from DynamoDB, old records without reward fields get defaults applied:
- All numeric fields default to 0
- `decay_exempt` defaults based on `question_format`

**Result:** Existing questions work immediately without migration

## Validation Rules

1. **Non-negative numbers:** All numeric reward fields must be >= 0
2. **Min/max constraints:**
   - `min_xp <= base_xp`
   - `min_gold <= base_gold`
3. **Type validation:** Numbers must be numbers, boolean must be boolean
4. **Optional fields:** All reward fields are optional in requests (defaults applied)

## Backward Compatibility

✅ **No breaking changes:**
- Existing questions without reward fields work immediately
- Read-time normalization applies defaults
- Old API requests (without reward fields) still work
- Frontend receives reward fields for all questions (old and new)

✅ **No data migration needed:**
- `applyRewardDefaults()` handles old records on-the-fly
- Defaults are applied consistently at read-time
- Write operations update records with new fields when modified

## Decay-Exempt Logic

**Question formats that are decay-exempt:**
- `SHORT_ANSWER`
- `ESSAY`

**Behavior:**
- `decay_exempt` is automatically set to `true` for these formats (unless explicitly overridden)
- When `question_format` is updated, `decay_exempt` is re-derived (unless explicitly provided in update)
- Decay fields are still stored even for decay-exempt questions (but ignored by reward logic)

## API Contract Changes

### Create Question - POST /quest-templates/{template_id}/questions
**New optional request fields:**
```json
{
  "base_xp": 100,
  "min_xp": 20,
  "xp_decay_per_wrong": 10,
  "base_gold": 50,
  "min_gold": 10,
  "gold_decay_per_wrong": 5,
  "decay_exempt": false
}
```

### Update Question - PATCH /quest-questions/{question_id}
**New optional request fields:**
```json
{
  "base_xp": 100,
  "min_xp": 20,
  "xp_decay_per_wrong": 10,
  "base_gold": 50,
  "min_gold": 10,
  "gold_decay_per_wrong": 5,
  "decay_exempt": false
}
```

### Get/List Responses
**All responses now include reward fields:**
```json
{
  "question_id": "...",
  "base_xp": 0,
  "min_xp": 0,
  "xp_decay_per_wrong": 0,
  "base_gold": 0,
  "min_gold": 0,
  "gold_decay_per_wrong": 0,
  "decay_exempt": true
}
```

## Testing Recommendations

1. **Create new question with reward config** - verify fields are stored correctly
2. **Create question without reward config** - verify defaults are applied
3. **Update existing question with reward config** - verify updates work
4. **Get old question** - verify defaults are applied at read-time
5. **List questions (mix of old and new)** - verify all have reward fields in response
6. **Validation tests:**
   - Negative values (should fail)
   - min_xp > base_xp (should fail)
   - min_gold > base_gold (should fail)
7. **Decay-exempt tests:**
   - Create SHORT_ANSWER question - verify decay_exempt = true
   - Update question_format from MCQ to ESSAY - verify decay_exempt becomes true
   - Explicitly set decay_exempt = false on ESSAY - verify it's respected

## Migration Notes

**No migration script needed.** Read-time normalization handles old records automatically.

**Optional future enhancement:** Add admin endpoint to backfill reward fields into existing records for cleaner database state. Not required for functionality.

## Next Steps

This implementation covers the QuestQuestions reward configuration only. Future work:
- Implement attempts table (Pattern B) to track student wrong answer counts
- Implement reward calculation logic that uses these fields
- Implement reward distribution when students complete questions
- Add UI forms for teachers to configure rewards when creating questions

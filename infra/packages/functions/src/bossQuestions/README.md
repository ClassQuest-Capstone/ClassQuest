# BossQuestions - Schema and API Documentation

## Overview

BossQuestions are the individual questions that make up a boss battle template. Each question is auto-gradable and can deal damage to the boss (on correct answer) or to the guild (on incorrect answer).

## Table Schema

**Table Name:** `BossQuestions`

### Primary Key
- **question_id** (string): UUID - Primary Key

### GSI1: boss_template_id
- **PK:** boss_template_id (string)
- **SK:** order_key (string) - Zero-padded order like "000001"

Used for: Querying all questions for a specific boss template in order

## Attributes

### Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| question_id | string | Yes | UUID - Primary key |
| boss_template_id | string | Yes | Parent boss template (GSI1 PK) |
| order_index | number | Yes | Numeric order (0-based) |
| order_key | string | Yes | Zero-padded order like "000001" (GSI1 SK) |
| question_text | string | Yes | The question prompt |
| question_type | BossQuestionType | Yes | Type of question (MCQ_SINGLE, MCQ_MULTI, TRUE_FALSE, SHORT_ANSWER, NUMERIC, OTHER) |
| options | any | No | Options for MCQ/matching questions |
| correct_answer | any | No | Expected answer (for auto-gradable questions) |
| damage_to_boss_on_correct | number | Yes | Damage dealt to boss on correct answer |
| damage_to_guild_on_incorrect | number | Yes | Damage guild takes on incorrect answer |
| max_points | number | No | Optional: max points for grading |
| auto_gradable | boolean | Yes | Whether system can auto-grade (must be true for boss questions) |
| **time_limit_seconds** | **number** | **No** | **Optional: time limit for this question (overrides battle default)** |
| created_at | string | Yes | ISO timestamp |
| updated_at | string | Yes | ISO timestamp |

### Validation Rules

#### time_limit_seconds
- **Optional**: Can be undefined/null (no time limit)
- **Positive Integer**: Must be >= 1 if provided
- **Rejects**: 0, negative values, non-integers (e.g., 2.5)
- **Overrides**: Any battle-level default time limit

**Examples:**
```typescript
// Valid: No time limit
{ time_limit_seconds: undefined }

// Valid: 30 second limit
{ time_limit_seconds: 30 }

// Valid: 2 minute limit
{ time_limit_seconds: 120 }

// Invalid: Zero
{ time_limit_seconds: 0 } // Error: must be positive integer

// Invalid: Negative
{ time_limit_seconds: -5 } // Error: must be positive integer

// Invalid: Decimal
{ time_limit_seconds: 2.5 } // Error: must be positive integer
```

## API Endpoints

### 1. Create Boss Question
**POST** `/boss-templates/{boss_template_id}/questions`

**Request Body:**
```json
{
  "order_index": 0,
  "question_text": "What is 2 + 2?",
  "question_type": "MCQ_SINGLE",
  "options": {
    "choices": [
      { "id": "a", "text": "3" },
      { "id": "b", "text": "4" },
      { "id": "c", "text": "5" }
    ]
  },
  "correct_answer": { "choiceId": "b" },
  "damage_to_boss_on_correct": 10,
  "damage_to_guild_on_incorrect": 5,
  "max_points": 10,
  "auto_gradable": true,
  "time_limit_seconds": 30
}
```

**Response (201):**
```json
{
  "question_id": "uuid-here",
  "order_key": "000000",
  "message": "Boss question created successfully"
}
```

### 2. Update Boss Question
**PATCH** `/boss-questions/{question_id}`

**Request Body:**
```json
{
  "question_text": "Updated question text",
  "time_limit_seconds": 60
}
```

**Response (200):**
```json
{
  "question_id": "uuid-here",
  "message": "Boss question updated successfully"
}
```

### 3. Get Boss Question
**GET** `/boss-questions/{question_id}`

**Response (200):**
```json
{
  "question_id": "uuid-here",
  "boss_template_id": "template-uuid",
  "order_index": 0,
  "order_key": "000000",
  "question_text": "What is 2 + 2?",
  "question_type": "MCQ_SINGLE",
  "options": { ... },
  "correct_answer": { "choiceId": "b" },
  "damage_to_boss_on_correct": 10,
  "damage_to_guild_on_incorrect": 5,
  "max_points": 10,
  "auto_gradable": true,
  "time_limit_seconds": 30,
  "created_at": "2026-02-24T12:00:00.000Z",
  "updated_at": "2026-02-24T12:00:00.000Z"
}
```

### 4. List Boss Questions by Template
**GET** `/boss-templates/{boss_template_id}/questions`

**Query Parameters:**
- `limit` (number, optional): Number of items to return
- `cursor` (string, optional): Pagination cursor

**Response (200):**
```json
{
  "items": [
    { /* question 1 */ },
    { /* question 2 */ }
  ],
  "cursor": "base64-encoded-cursor"
}
```

### 5. Delete Boss Question
**DELETE** `/boss-questions/{question_id}`

**Response (200):**
```json
{
  "message": "Boss question deleted successfully"
}
```

## Frontend Types

**Location:** `app/frontend/src/api/bossQuestions/types.ts`

```typescript
export type BossQuestion = {
    question_id: string;
    boss_template_id: string;
    order_index: number;
    order_key: string;
    question_text: string;
    question_type: BossQuestionType;
    options?: any;
    correct_answer?: any;
    damage_to_boss_on_correct: number;
    damage_to_guild_on_incorrect: number;
    max_points?: number;
    auto_gradable: boolean;
    time_limit_seconds?: number;  // NEW: Optional time limit
    created_at: string;
    updated_at: string;
};

export type CreateBossQuestionInput = {
    order_index: number;
    question_text: string;
    question_type: BossQuestionType;
    options?: any;
    correct_answer?: any;
    damage_to_boss_on_correct: number;
    damage_to_guild_on_incorrect: number;
    max_points?: number;
    auto_gradable: boolean;
    time_limit_seconds?: number;  // NEW: Optional time limit
};

export type UpdateBossQuestionInput = Partial<CreateBossQuestionInput>;
```

## Implementation Notes

### Backward Compatibility
- **Additive Change Only**: Existing questions without `time_limit_seconds` continue to work
- **No Migration Required**: DynamoDB is schemaless; attribute is simply absent for old records
- **Get/List Endpoints**: Return the field when present, omit when absent
- **Default Behavior**: When undefined, boss battle uses its default time limit (if any)

### Time Limit Hierarchy
1. **Question-level**: `time_limit_seconds` on BossQuestion (highest priority)
2. **Battle-level**: Default time limit on BossBattleTemplate (if question has no limit)
3. **No Limit**: If neither is set, no time limit is enforced

### Validation Strategy
- **Creation**: Validate if provided, skip validation if undefined
- **Update**: Validate if provided in update body, leave unchanged if not provided
- **Rule**: Must be positive integer (>= 1) if present

## Testing

Run validation tests:
```bash
cd infra/packages/functions/src/bossQuestions
node --loader tsx validation.test.ts
```

**Test Coverage:**
- ✅ No time_limit_seconds → accepted
- ✅ time_limit_seconds = 30 → accepted
- ✅ time_limit_seconds = 0 → rejected
- ✅ time_limit_seconds = -5 → rejected
- ✅ time_limit_seconds = 2.5 → rejected

## Example Usage

### Creating a Question with Time Limit
```typescript
import { api } from './api/http';

const response = await api<{ question_id: string }>(
  '/boss-templates/template-123/questions',
  {
    method: 'POST',
    body: JSON.stringify({
      order_index: 0,
      question_text: "Quick! What's 2+2?",
      question_type: "MCQ_SINGLE",
      options: { choices: [...] },
      correct_answer: { choiceId: "b" },
      damage_to_boss_on_correct: 15,
      damage_to_guild_on_incorrect: 5,
      auto_gradable: true,
      time_limit_seconds: 10 // 10 second time limit
    })
  }
);
```

### Creating a Question Without Time Limit
```typescript
// Simply omit the field - no time limit will be enforced
const response = await api<{ question_id: string }>(
  '/boss-templates/template-123/questions',
  {
    method: 'POST',
    body: JSON.stringify({
      order_index: 1,
      question_text: "Take your time: Solve this equation",
      question_type: "NUMERIC",
      correct_answer: { value: 42 },
      damage_to_boss_on_correct: 20,
      damage_to_guild_on_incorrect: 10,
      auto_gradable: true
      // time_limit_seconds is omitted
    })
  }
);
```

### Updating Time Limit
```typescript
// Add or change time limit
await api('/boss-questions/question-123', {
  method: 'PATCH',
  body: JSON.stringify({
    time_limit_seconds: 60 // Update to 60 seconds
  })
});

// Remove time limit is not supported via update
// Consider creating a new question instead
```

## Related Documentation
- BossBattleTemplates: `../bossBattleTemplates/README.md`
- QuestQuestions (similar pattern): `../questQuestions/README.md`

---

**Last Updated:** 2026-02-24
**Feature Added:** Optional per-question time limits

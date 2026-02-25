# QuestAnswerAttempts - Implementation Documentation

## Overview

The QuestAnswerAttempts feature stores individual submission attempts for quest questions. This is an additive feature that complements the existing QuestQuestionResponses table, which maintains rolled-up summary records.

## Key Features

- **Individual Attempt Tracking**: Each submission is stored as a separate record
- **Atomic Counter Allocation**: Thread-safe attempt numbering using DynamoDB counters
- **Flexible Querying**: 2 GSIs support queries by student, question, and analytics
- **Grading Support**: Store auto-grading and teacher grading results per attempt
- **Reward Linkage**: Optional fields for XP/gold/hearts and reward transaction IDs

---

## Database Schema

### Table: QuestAnswerAttempts

**Primary Keys:**
- `quest_attempt_pk` (string): `QI#<quest_instance_id>#S#<student_id>#Q#<question_id>`
- `attempt_sk` (string): `A#<attempt_no_padded>#T#<created_at_iso>`
  - `attempt_no_padded`: Zero-padded to 6 digits (e.g., 000001)

**Core Attributes:**
- `quest_instance_id` (string): Quest instance reference
- `student_id` (string): Student submitting the answer
- `question_id` (string): Question being answered
- `attempt_no` (number): Sequential attempt number (server-generated)
- `answer_raw` (string): Raw answer content (max 20k characters)
- `answer_normalized` (string, optional): Normalized/processed answer
- `is_correct` (boolean, optional): Grade outcome
- `auto_grade_result` (string, optional): JSON string with auto-grading details
- `teacher_grade_status` (TeacherGradeStatus, optional): PENDING | GRADED
- `graded_at` (string, optional): ISO timestamp when graded
- `grader_type` (GraderType, optional): AUTO | TEACHER | SYSTEM
- `created_at` (string): ISO timestamp (server-generated)

**Reward Linkage (Optional):**
- `xp_awarded` (number): XP awarded for this attempt
- `gold_awarded` (number): Gold awarded for this attempt
- `reward_txn_id` (string): Reference to RewardTransaction

**GSI Keys:**
- `gsi1_pk`: `S#<student_id>#QI#<quest_instance_id>`
- `gsi1_sk`: `T#<created_at>#Q#<question_id>#A#<attempt_no_padded>`
- `gsi2_pk`: `QI#<quest_instance_id>#Q#<question_id>`
- `gsi2_sk`: `T#<created_at>#S#<student_id>#A#<attempt_no_padded>`

### Counter Items

Counter items are stored in the same table with a special format:
- `quest_attempt_pk`: `COUNTER#QI#<quest_instance_id>#S#<student_id>#Q#<question_id>`
- `attempt_sk`: `COUNTER` (fixed value)
- `next_attempt_no` (number): Next attempt number to allocate

**Note:** Counter items are filtered out from query results using `begins_with(attempt_sk, 'A#')`.

---

## API Endpoints

### 1. Create Attempt
**POST /quest-answer-attempts**

**Authorization:** Student (self only), System, Admin

**Request Body:**
```json
{
  "quest_instance_id": "required",
  "question_id": "required",
  "answer_raw": "required",
  "answer_normalized": "optional"
}
```

**Response (201):**
```json
{
  "message": "Attempt created successfully",
  "attempt": {
    "quest_attempt_pk": "QI#qi123#S#s456#Q#q789",
    "attempt_sk": "A#000001#T#2026-02-23T12:34:56.789Z",
    "quest_instance_id": "qi123",
    "student_id": "s456",
    "question_id": "q789",
    "attempt_no": 1,
    "answer_raw": "Student's answer",
    "created_at": "2026-02-23T12:34:56.789Z",
    "gsi1_pk": "S#s456#QI#qi123",
    "gsi1_sk": "T#2026-02-23T12:34:56.789Z#Q#q789#A#000001",
    "gsi2_pk": "QI#qi123#Q#q789",
    "gsi2_sk": "T#2026-02-23T12:34:56.789Z#S#s456#A#000001"
  }
}
```

**Behavior:**
- Derives `student_id` from auth principal (students can only create for themselves)
- Atomically allocates `attempt_no` using counter strategy
- Server-generates `created_at`, `quest_attempt_pk`, `attempt_sk`, and GSI keys
- Clients cannot specify `attempt_no` or key fields directly

---

### 2. List Attempts by Instance + Student + Question
**GET /quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts**

**Authorization:** Student (self only), Teacher, Admin

**Query Parameters:**
- `limit` (number, optional): Number of items to return
- `cursor` (string, optional): Pagination cursor

**Response (200):**
```json
{
  "items": [
    { /* attempt 1 */ },
    { /* attempt 2 */ }
  ],
  "cursor": "base64-encoded-last-evaluated-key"
}
```

**Behavior:**
- Queries by primary key (PK)
- Results sorted by `attempt_sk` descending (most recent first)
- Filters out counter items using `begins_with(attempt_sk, 'A#')`

---

### 3. List Attempts by Student in Instance
**GET /quest-instances/{quest_instance_id}/students/{student_id}/attempts**

**Authorization:** Student (self only), Teacher, Admin

**Query Parameters:**
- `limit` (number, optional)
- `cursor` (string, optional)

**Response (200):**
```json
{
  "items": [
    { /* attempt 1 */ },
    { /* attempt 2 */ }
  ],
  "cursor": "base64-encoded-last-evaluated-key"
}
```

**Behavior:**
- Queries GSI1 by `S#<student_id>#QI#<quest_instance_id>`
- Returns all attempts by student across all questions in the quest instance
- Sorted by `gsi1_sk` descending (most recent first)

---

### 4. List Attempts by Question in Instance
**GET /quest-instances/{quest_instance_id}/questions/{question_id}/attempts**

**Authorization:** Teacher, Admin only (analytics endpoint)

**Query Parameters:**
- `limit` (number, optional)
- `cursor` (string, optional)

**Response (200):**
```json
{
  "items": [
    { /* attempt 1 */ },
    { /* attempt 2 */ }
  ],
  "cursor": "base64-encoded-last-evaluated-key"
}
```

**Behavior:**
- Queries GSI2 by `QI#<quest_instance_id>#Q#<question_id>`
- Returns all attempts for a question across all students
- Sorted by `gsi2_sk` descending (most recent first)
- Useful for teacher analytics (e.g., how many students got this question right?)

---

### 5. Grade Attempt
**PATCH /quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts/{attempt_no}/grade**

**Authorization:** Teacher, Admin, System only (students cannot grade)

**Request Body:**
```json
{
  "is_correct": true,
  "grader_type": "TEACHER",
  "teacher_grade_status": "GRADED",
  "auto_grade_result": "optional-json-string",
  "xp_awarded": 100,
  "gold_awarded": 50,
  "reward_txn_id": "optional-transaction-id"
}
```

**Response (200):**
```json
{
  "message": "Attempt graded successfully",
  "graded_at": "2026-02-23T13:00:00.000Z"
}
```

**Behavior:**
- Server-generates `graded_at` timestamp
- Updates only the specified fields (partial update)
- Requires querying to find the exact `attempt_sk` (since it includes `created_at`)
- Reward fields (`xp_awarded`, `gold_awarded`, `reward_txn_id`) are optional

---

## Code Structure

### Files

```
questAnswerAttempts/
├── types.ts              # Type definitions, enums, helper functions
├── validation.ts         # Input validation rules
├── repo.ts               # DynamoDB operations + counter allocation
├── create-attempt.ts     # POST handler
├── list-by-pk.ts         # GET by (instance, student, question)
├── list-by-gsi1.ts       # GET by student in instance
├── list-by-gsi2.ts       # GET by question in instance (teacher analytics)
├── grade-attempt.ts      # PATCH grading handler
└── README.md             # This file
```

### Key Functions

**types.ts:**
- `buildQuestAttemptPK(...)`: Builds primary key
- `buildAttemptSK(attempt_no, created_at)`: Builds sort key with zero-padded attempt number
- `buildGSIKeys(...)`: Builds all GSI keys
- `buildCounterPK(...)`: Builds counter key for attempt number allocation

**validation.ts:**
- `validateRequiredIds(data)`: Validates quest_instance_id, student_id, question_id
- `validateAnswerRaw(answer)`: Validates answer content and length
- `validateCreateAttemptData(data)`: Comprehensive create validation
- `validateGradeAttemptData(data)`: Comprehensive grading validation

**repo.ts:**
- `allocateAttemptNo(...)`: Atomically allocates next attempt number using counter
- `createAttemptWithCounter(...)`: Creates attempt with atomic counter allocation
- `queryByPK(...)`: Query by primary key with pagination
- `queryByGSI1(...)`: Query by student in instance (GSI1)
- `queryByGSI2(...)`: Query by question in instance (GSI2)
- `updateAttemptGrade(...)`: Update grading fields for a specific attempt

---

## Attempt Number Allocation Strategy

### Atomic Counter Approach

To prevent race conditions when multiple students submit answers simultaneously, we use an atomic counter strategy:

1. **Counter Storage**: Each (quest_instance, student, question) combination has a counter item:
   - PK: `COUNTER#QI#<quest_instance_id>#S#<student_id>#Q#<question_id>`
   - SK: `COUNTER` (fixed)
   - Attribute: `next_attempt_no` (number)

2. **Atomic Increment**: When creating an attempt:
   ```typescript
   await ddb.send(
     new UpdateCommand({
       TableName: TABLE,
       Key: { quest_attempt_pk: counterPK, attempt_sk: "COUNTER" },
       UpdateExpression: "ADD next_attempt_no :inc",
       ExpressionAttributeValues: { ":inc": 1 },
       ReturnValues: "UPDATED_NEW",
     })
   );
   ```

3. **Guaranteed Uniqueness**: DynamoDB's ADD operation is atomic, ensuring:
   - No two concurrent requests get the same `attempt_no`
   - Counter automatically initializes to 1 on first increment
   - No conditional logic or retry loops needed

4. **Query Filtering**: Counter items are filtered out using `begins_with(attempt_sk, 'A#')` in queries

### Why This Approach?

- **Thread-Safe**: No race conditions or duplicate attempt numbers
- **Simple**: No need for complex locking or conditional checks
- **Scalable**: DynamoDB handles concurrent updates efficiently
- **Consistent**: Works reliably even under high load

---

## Frontend Integration

### API Client

**File:** `app/frontend/src/api/questAnswerAttempts.ts`

**Functions:**
- `createQuestAnswerAttempt(body)`: Create new attempt
- `listAttemptsByInstanceStudentQuestion(instanceId, studentId, questionId, options?)`: List attempts for specific question
- `listAttemptsByStudentInInstance(instanceId, studentId, options?)`: List all attempts by student
- `listAttemptsByQuestionInInstance(instanceId, questionId, options?)`: Teacher analytics
- `gradeQuestAnswerAttempt(instanceId, studentId, questionId, attemptNo, body)`: Grade attempt

**Example Usage:**
```typescript
import {
  createQuestAnswerAttempt,
  listAttemptsByInstanceStudentQuestion,
  gradeQuestAnswerAttempt,
} from './api/questAnswerAttempts';

// Student submits answer
const result = await createQuestAnswerAttempt({
  quest_instance_id: 'qi123',
  question_id: 'q789',
  answer_raw: 'Student answer here',
});

// View attempt history
const attempts = await listAttemptsByInstanceStudentQuestion(
  'qi123',
  's456',
  'q789',
  { limit: 10 }
);

// Teacher grades attempt
await gradeQuestAnswerAttempt('qi123', 's456', 'q789', 1, {
  is_correct: true,
  grader_type: 'TEACHER',
  teacher_grade_status: 'GRADED',
  xp_awarded: 100,
  gold_awarded: 50,
});
```

---

## Relationship with QuestQuestionResponses

### Complementary Design

- **QuestAnswerAttempts**: Detailed attempt history (this feature)
  - Stores every submission attempt
  - Useful for analytics and debugging
  - Supports multiple attempts per question

- **QuestQuestionResponses**: Rolled-up summary record (existing feature)
  - Stores final/latest response state
  - Tracks aggregate counters (attempt_count, wrong_attempt_count)
  - Links to reward transactions
  - Used for progress tracking

### Integration Points

1. **Creating Attempts**: When a student submits an answer:
   - Create new `QuestAnswerAttempt` record (this API)
   - Update `QuestQuestionResponse` summary counters (separate logic)

2. **Grading**: When grading occurs:
   - Update specific `QuestAnswerAttempt` with grade (this API)
   - Update `QuestQuestionResponse` status and reward linkage (separate logic)

3. **Reward Pipeline**: When rewards are awarded:
   - `QuestAnswerAttempt` stores XP/gold awarded for that specific attempt
   - `QuestQuestionResponse` stores total XP/gold across all attempts
   - Both reference the same `reward_txn_id` from RewardTransactions

### Best Practices

- **Don't duplicate logic**: Keep attempt-specific data in QuestAnswerAttempts
- **Maintain consistency**: Update both tables in sequence (not transactionally)
- **Query efficiency**: Use QuestQuestionResponses for summaries, QuestAnswerAttempts for drill-down

---

## Important Notes

### Authorization Rules

- **Create Attempt**: Students can only create for themselves (derived from JWT)
- **List by PK/GSI1**: Students can only view their own attempts
- **List by GSI2**: Teachers/admins only (analytics endpoint)
- **Grade Attempt**: Teachers/admins/system only (students cannot grade)

### Validation Rules

- `answer_raw`: Required, max 20k characters
- `attempt_no`: Server-generated only, clients cannot specify
- `xp_awarded` / `gold_awarded`: Must be >= 0 if provided
- `reward_txn_id`: Non-empty string if provided
- `teacher_grade_status`: Must be PENDING or GRADED
- `grader_type`: Must be AUTO, TEACHER, or SYSTEM

### Performance Considerations

- **Counter Overhead**: Each submission requires 2 writes (counter update + attempt create)
- **Query Filtering**: Counter items are filtered client-side (not via DynamoDB filter expression)
- **Pagination**: Use cursors for large result sets to avoid memory issues

---

## Deployment

The QuestAnswerAttempts routes are deployed as part of **QuestApiStack**.

### Routes Added:
- POST /quest-answer-attempts
- GET /quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts
- GET /quest-instances/{quest_instance_id}/students/{student_id}/attempts
- GET /quest-instances/{quest_instance_id}/questions/{question_id}/attempts
- PATCH /quest-instances/{quest_instance_id}/students/{student_id}/questions/{question_id}/attempts/{attempt_no}/grade

### Environment Variable:
- `QUEST_ANSWER_ATTEMPTS_TABLE_NAME`

---

## Testing Checklist

### Manual Testing

- [ ] Create attempt as student (should succeed)
- [ ] Create attempt as student for another student (should fail with 403)
- [ ] Create multiple attempts for same question (attempt_no increments correctly)
- [ ] Concurrent submissions don't create duplicate attempt_no
- [ ] List attempts by PK (pagination works)
- [ ] List attempts by GSI1 (student in instance)
- [ ] List attempts by GSI2 as student (should fail with 403)
- [ ] List attempts by GSI2 as teacher (should succeed)
- [ ] Grade attempt as teacher (should succeed)
- [ ] Grade attempt as student (should fail with 403)
- [ ] Validate answer_raw max length (20k characters)
- [ ] Validate required fields (quest_instance_id, question_id, answer_raw)

### Integration Testing

- [ ] Counter items are filtered out from query results
- [ ] GSI queries return results in correct order (descending by time)
- [ ] Pagination cursors work across pages
- [ ] Grading updates find correct attempt using attempt_no
- [ ] Reward linkage fields store correctly

---

## Future Enhancements

1. **Auto-Grading Integration**
   - Trigger auto-grading Lambda on attempt creation
   - Store auto_grade_result JSON with detailed feedback

2. **Attempt Comparison**
   - API endpoint to compare multiple attempts side-by-side
   - Useful for teacher review

3. **Batch Grading**
   - Grade multiple attempts at once
   - Useful for bulk grading workflows

4. **Analytics Aggregations**
   - Average attempt count per question
   - Success rate on first attempt
   - Time between attempts

5. **Soft Delete**
   - Mark attempts as deleted instead of hard delete
   - Preserve audit trail

---

## Related Documentation

- QuestQuestionResponses (summary records): `infra/packages/functions/src/questQuestionResponses/README.md`
- RewardTransactions (reward ledger): `infra/packages/functions/src/rewardTransactions/README.md`
- QuestQuestions (question config): `infra/packages/functions/src/questQuestions/README.md`

---

**Last Updated:** 2026-02-23
**Author:** Claude Code (AI Assistant)

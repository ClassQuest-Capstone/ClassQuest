# RewardTransactions - Implementation Documentation

## Overview

The RewardTransactions feature provides an **immutable ledger** for tracking XP, gold, and hearts deltas awarded to students. This is a write-only system that records all reward transactions without applying them directly to player states.

## Key Features

- **Immutable Ledger**: Transactions are write-once and never modified
- **Idempotency**: Deterministic transaction IDs prevent duplicate rewards
- **Flexible Querying**: 3 GSIs support queries by student, class, and source
- **Authorization**: Strict role-based access control
- **Audit Trail**: Full history with creator tracking

---

## Database Schema

### Table: RewardTransactions

**Primary Key:**
- `transaction_id` (string): Deterministic or UUID

**Attributes:**
- `student_id` (string): Student receiving the reward
- `class_id` (string, optional): Class context
- `xp_delta` (number): XP change (can be negative)
- `gold_delta` (number): Gold change (can be negative)
- `hearts_delta` (number): Hearts change (can be negative)
- `source_type` (SourceType enum): Origin of the reward
- `source_id` (string, optional): Generic source identifier
- `quest_instance_id` (string, optional): Quest instance reference
- `question_id` (string, optional): Question reference
- `boss_battle_instance_id` (string, optional): Boss battle reference
- `attempt_pk` (string, optional): Response PK for linkage
- `reason` (string, optional): Human-readable explanation
- `created_at` (string): ISO timestamp (server-generated)
- `created_by` (string): Creator's user_id (from Cognito)
- `created_by_role` (CreatedByRole enum): Creator's role
- `metadata` (object, optional): Arbitrary JSON data

**GSI Keys:**
- `gsi1_pk`: `S#<student_id>` - Student timeline
- `gsi1_sk`: `T#<created_at>#TX#<transaction_id>` - Sorted by time
- `gsi2_pk`: `C#<class_id>#S#<student_id>` - Student per class
- `gsi2_sk`: `T#<created_at>#TX#<transaction_id>` - Sorted by time
- `gsi3_pk`: `SRC#<source_type>#<source_id>` - Source lookup
- `gsi3_sk`: `T#<created_at>#S#<student_id>#TX#<transaction_id>` - Sorted by time and student

### Enums

**SourceType:**
- `QUEST_QUESTION`: Reward from answering a quest question
- `QUEST_COMPLETION`: Reward for completing an entire quest
- `BOSS_BATTLE`: Reward from boss battle participation
- `MANUAL_ADJUSTMENT`: Teacher/admin manual adjustment
- `SYSTEM_ADJUSTMENT`: Automated system correction

**CreatedByRole:**
- `TEACHER`: Created by a teacher
- `ADMIN`: Created by an admin
- `SYSTEM`: Created by automated system

---

## API Endpoints

### 1. Create Transaction
**POST /reward-transactions**

**Authorization:** TEACHER, ADMIN, SYSTEM only

**Request Body:**
```json
{
  "transaction_id": "optional-deterministic-id",
  "student_id": "required",
  "class_id": "optional",
  "xp_delta": 100,
  "gold_delta": 50,
  "hearts_delta": 0,
  "source_type": "QUEST_QUESTION",
  "source_id": "optional",
  "quest_instance_id": "required-for-quest-question",
  "question_id": "required-for-quest-question",
  "boss_battle_instance_id": "required-for-boss-battle",
  "attempt_pk": "optional",
  "reason": "Correct answer on first attempt",
  "metadata": {}
}
```

**Response (201):**
```json
{
  "message": "Transaction created successfully",
  "transaction_id": "QUESTQ#qi123#s456#q789",
  "item": { /* full transaction object */ }
}
```

**Response (409):** Idempotent duplicate
```json
{
  "error": "Transaction already exists (idempotent duplicate)",
  "transaction_id": "QUESTQ#qi123#s456#q789"
}
```

**Behavior:**
- Server generates `created_at` (ignores client value)
- Server derives `created_by` and `created_by_role` from Cognito JWT
- Computes GSI keys automatically
- If `transaction_id` not provided:
  - For `QUEST_QUESTION` with required fields: generates `QUESTQ#<instance>#<student>#<question>`
  - For `BOSS_BATTLE` with required fields: generates `BOSS#<boss_instance>#<student>`
  - Otherwise: generates random UUID
- Conditional put ensures idempotency (fails if transaction_id exists)

**Validation:**
- At least one delta must be non-zero
- `source_type` determines required linkage fields:
  - `QUEST_QUESTION`: requires `quest_instance_id` and `question_id`
  - `BOSS_BATTLE`: requires `boss_battle_instance_id`

---

### 2. Get Transaction
**GET /reward-transactions/{transaction_id}**

**Authorization:** TEACHER, ADMIN, SYSTEM, or the student who owns the transaction

**Response (200):**
```json
{
  "transaction_id": "QUESTQ#qi123#s456#q789",
  "student_id": "s456",
  "class_id": "c123",
  "xp_delta": 100,
  "gold_delta": 50,
  "hearts_delta": 0,
  "source_type": "QUEST_QUESTION",
  "quest_instance_id": "qi123",
  "question_id": "q789",
  "created_at": "2026-02-23T12:34:56.789Z",
  "created_by": "t123",
  "created_by_role": "TEACHER",
  "gsi1_pk": "S#s456",
  "gsi1_sk": "T#2026-02-23T12:34:56.789Z#TX#QUESTQ#qi123#s456#q789",
  ...
}
```

**Response (403):** Student trying to view another student's transaction
```json
{
  "error": "Forbidden: You can only view your own transactions"
}
```

---

### 3. List Transactions by Student
**GET /reward-transactions/by-student/{student_id}**

**Authorization:** TEACHER, ADMIN, SYSTEM, or the student themselves

**Query Parameters:**
- `limit` (number, optional): Number of items to return
- `cursor` (string, optional): Pagination cursor from previous response

**Response (200):**
```json
{
  "items": [
    { /* transaction 1 */ },
    { /* transaction 2 */ }
  ],
  "cursor": "base64-encoded-last-evaluated-key"
}
```

**Behavior:**
- Queries GSI1 by `S#<student_id>`
- Results sorted by `created_at` descending (most recent first)
- Returns transactions across ALL classes

---

### 4. List Transactions by Student and Class
**GET /reward-transactions/by-student/{student_id}/class/{class_id}**

**Authorization:** TEACHER (of that class), ADMIN, SYSTEM, or the student themselves

**Query Parameters:**
- `limit` (number, optional)
- `cursor` (string, optional)

**Response (200):**
```json
{
  "items": [
    { /* transaction 1 */ },
    { /* transaction 2 */ }
  ],
  "cursor": "base64-encoded-last-evaluated-key"
}
```

**Behavior:**
- Queries GSI2 by `C#<class_id>#S#<student_id>`
- Results sorted by `created_at` descending
- Returns transactions for specific student in specific class

---

### 5. List Transactions by Source
**GET /reward-transactions/by-source/{source_type}/{source_id}**

**Authorization:** TEACHER, ADMIN, SYSTEM only (students cannot access)

**Query Parameters:**
- `limit` (number, optional)
- `cursor` (string, optional)

**Response (200):**
```json
{
  "items": [
    { /* transaction 1 */ },
    { /* transaction 2 */ }
  ],
  "cursor": "base64-encoded-last-evaluated-key"
}
```

**Behavior:**
- Queries GSI3 by `SRC#<source_type>#<source_id>`
- Results sorted by `created_at` descending
- Useful for finding all transactions from a specific quest instance or boss battle

---

## Code Structure

### Files

```
rewardTransactions/
├── types.ts                        # Type definitions and helper functions
├── validation.ts                   # Input validation rules
├── repo.ts                         # DynamoDB operations
├── create-transaction.ts           # POST handler
├── get-transaction.ts              # GET by ID handler
├── list-by-student.ts              # GET by student handler
├── list-by-student-and-class.ts    # GET by student+class handler
├── list-by-source.ts               # GET by source handler
└── README.md                       # This file
```

### Key Functions

**types.ts:**
- `computeGSIKeys(item)`: Generates all GSI keys for a transaction
- `generateDeterministicTransactionId(...)`: Creates idempotent transaction IDs

**validation.ts:**
- `validateTransactionId(id)`: Validates format and length
- `validateSourceType(type)`: Validates enum value
- `validateDeltas(xp, gold, hearts)`: Ensures at least one is non-zero
- `validateSourceLinkage(data)`: Validates required fields per source_type
- `validateTransactionData(data)`: Comprehensive validation

**repo.ts:**
- `putTransaction(item)`: Conditional put for idempotency
- `getTransaction(id)`: Fetch by primary key
- `listByStudent(student_id, limit?, cursor?)`: Query GSI1
- `listByStudentAndClass(student_id, class_id, limit?, cursor?)`: Query GSI2
- `listBySource(source_type, source_id, limit?, cursor?)`: Query GSI3

---

## Frontend Integration

### API Client

**File:** `app/frontend/src/api/rewardTransactions.ts`

**Functions:**
- `createTransaction(body)`: Create new transaction
- `getTransaction(transactionId)`: Get by ID
- `listTransactionsByStudent(studentId, options?)`: List by student
- `listTransactionsByStudentAndClass(studentId, classId, options?)`: List by student+class
- `listTransactionsBySource(sourceType, sourceId, options?)`: List by source

**Example Usage:**
```typescript
import { createTransaction, listTransactionsByStudent } from './api/rewardTransactions';

// Create transaction
const result = await createTransaction({
  student_id: 's123',
  class_id: 'c456',
  xp_delta: 100,
  gold_delta: 50,
  hearts_delta: 0,
  source_type: 'QUEST_QUESTION',
  quest_instance_id: 'qi789',
  question_id: 'q012',
  reason: 'Correct answer',
});

// List student transactions
const transactions = await listTransactionsByStudent('s123', { limit: 20 });
```

---

## Integration with Quest System

### Quest Question Reward Pipeline

The reward system integrates with `QuestQuestionResponses` through the following workflow:

1. **Student submits answer** → `QuestQuestionResponses.upsert-response.ts`
   - Updates `attempt_count`, `wrong_attempt_count`, `status`
   - Does NOT create reward transaction yet

2. **Teacher grades response** → `QuestQuestionResponses.grade-response.ts`
   - Computes reward based on question's reward config
   - Creates `RewardTransaction` with deterministic ID
   - Updates response with `xp_awarded_total`, `gold_awarded_total`, `reward_txn_id`
   - Sets `reward_status` to "PENDING"

3. **Reward pipeline applies transaction** → `QuestQuestionResponses.mark-reward-applied.ts`
   - Updates `PlayerStates` table (separate system)
   - Marks response `reward_status` as "APPLIED"

4. **If grade changes** → Reward pipeline reverses transaction
   - Marks original transaction as reversed (via metadata or separate tracking)
   - Creates new transaction with adjusted deltas
   - Updates response with new `reward_txn_id` and recalculated totals

---

## Important Notes

### Idempotency

Deterministic transaction IDs ensure that the same reward event cannot create duplicate transactions:

- **Quest Questions:** `QUESTQ#<quest_instance_id>#<student_id>#<question_id>`
- **Boss Battles:** `BOSS#<boss_battle_instance_id>#<student_id>`
- **Manual/System:** Random UUID (caller responsible for deduplication)

### Ledger vs. Player States

**RewardTransactions is a ledger only.** It does NOT update `PlayerStates`:

- Transactions record what SHOULD be awarded
- `PlayerStates` reflects what HAS been awarded
- A separate reward pipeline reads transactions and applies them to player states
- This separation enables:
  - Audit trails
  - Rollback capabilities
  - Dispute resolution
  - Historical analysis

### Authorization Strategy

- **Create:** TEACHER, ADMIN, SYSTEM only
- **Read (by ID):** Anyone, but students restricted to their own
- **List (by student):** Anyone, but students restricted to their own
- **List (by source):** TEACHER, ADMIN, SYSTEM only

---

## Deployment

The RewardTransactions routes are deployed as part of **QuestApiStack**.

### Stack Configuration

Routes added to `infra/stacks/QuestApiStack.ts`:
- POST /reward-transactions
- GET /reward-transactions/{transaction_id}
- GET /reward-transactions/by-student/{student_id}
- GET /reward-transactions/by-student/{student_id}/class/{class_id}
- GET /reward-transactions/by-source/{source_type}/{source_id}

Environment variable injected:
- `REWARD_TRANSACTIONS_TABLE_NAME`

---

## Testing Checklist

### Manual Testing

- [ ] Create transaction as teacher (should succeed)
- [ ] Create transaction as student (should fail with 403)
- [ ] Create duplicate transaction (should return 409)
- [ ] Get transaction as owner (should succeed)
- [ ] Get transaction as other student (should fail with 403)
- [ ] List transactions by student (pagination test)
- [ ] List transactions by student+class (filtering test)
- [ ] List transactions by source (teacher only)
- [ ] Validate at least one delta is non-zero
- [ ] Validate source_type enum values
- [ ] Validate required linkage fields per source_type

### Integration Testing

- [ ] Quest question grading creates transaction
- [ ] Deterministic transaction ID prevents duplicates
- [ ] Response linkage fields updated correctly
- [ ] GSI queries return results in correct order
- [ ] Pagination cursors work across pages

---

## Future Enhancements

1. **Reverse Transaction Endpoint**
   - Optional `PATCH /reward-transactions/{transaction_id}/reverse`
   - Creates offsetting transaction (negative deltas)
   - Links to original via metadata

2. **Aggregation Queries**
   - Total XP/gold/hearts by student in time range
   - Leaderboard by reward totals
   - Class-wide reward statistics

3. **Bulk Operations**
   - Batch create transactions for entire class
   - Useful for quest completion rewards

4. **Export/Reporting**
   - CSV export of transactions
   - Audit report generation
   - Analytics integration

---

## Related Documentation

- QuestQuestions reward configuration: `infra/packages/functions/src/questQuestions/README.md`
- QuestQuestionResponses reward linkage: `infra/packages/functions/src/questQuestionResponses/README.md`
- PlayerStates updates: (to be documented in future)

---

**Last Updated:** 2026-02-23
**Author:** Claude Code (AI Assistant)

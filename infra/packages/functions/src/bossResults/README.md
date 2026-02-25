## BossResults - Post-Battle Aggregated Summaries

## Overview

BossResults stores **immutable**, post-battle aggregated summaries for completed boss battles. Written once when a BossBattleInstance transitions to COMPLETED or ABORTED. Provides instant access to battle outcomes, student performance, guild statistics, and reward totals for teacher recap screens, student summaries, and analytics.

## Table Schema

**Table Name:** `BossResults`

### Primary Key (Composite)

- **boss_result_pk** (string): `BI#<boss_instance_id>`
- **boss_result_sk** (string): Multiple item types
  - Student rows: `STU#<student_id>`
  - Guild rows: `GUILD#<guild_id>`
  - Meta row: `META` (idempotency guard)

**Rationale:** Single query returns all results for a battle (students + guilds). Sort key groups by type.

### Common Attributes

All rows include:

| Field | Type | Description |
|-------|------|-------------|
| boss_result_pk | string | Primary key |
| boss_result_sk | string | Sort key (type + ID) |
| boss_instance_id | string | Battle instance UUID |
| class_id | string | Class UUID |
| boss_template_id | string | Template UUID |
| outcome | BattleOutcome | WIN \| FAIL \| ABORTED |
| completed_at | string (ISO) | Battle completion timestamp |
| created_at | string (ISO) | Row creation timestamp |
| fail_reason | FailReason? | TIMEOUT \| ALL_GUILDS_DOWN \| OUT_OF_QUESTIONS \| ABORTED_BY_TEACHER |

### Student Row Attributes (`STU#<student_id>`)

| Field | Type | Description |
|-------|------|-------------|
| student_id | string | Student UUID |
| guild_id | string | Guild UUID at battle time |
| total_correct | number | Correct answers |
| total_incorrect | number | Incorrect answers |
| total_attempts | number | Total submissions |
| total_damage_to_boss | number | Total damage dealt |
| hearts_lost | number | Hearts lost during battle |
| xp_awarded | number | XP from RewardTransactions |
| gold_awarded | number | Gold from RewardTransactions |
| participation_state | ParticipationState | JOINED \| SPECTATE \| KICKED \| LEFT \| DOWNED |
| last_answered_at | string (ISO)? | Last submission timestamp |
| gsi1_sk | string | completed_at#boss_instance_id (student history) |
| gsi2_sk | string | completed_at#boss_instance_id (class history) |
| reward_txn_ids | string[]? | RewardTransactions IDs |

### Guild Row Attributes (`GUILD#<guild_id>`)

| Field | Type | Description |
|-------|------|-------------|
| guild_id | string | Guild UUID |
| guild_total_correct | number | Guild total correct answers |
| guild_total_incorrect | number | Guild total incorrect answers |
| guild_total_attempts | number | Guild total submissions |
| guild_total_damage_to_boss | number | Guild total damage dealt |
| guild_total_hearts_lost | number | Guild total hearts lost |
| guild_xp_awarded_total | number | Sum of all member XP |
| guild_gold_awarded_total | number | Sum of all member gold |
| guild_members_joined | number | Count of JOINED/SPECTATE members |
| guild_members_downed | number | Count of downed members |
| gsi2_sk | string | completed_at#boss_instance_id (class history) |

### Meta Row Attributes (`META`)

| Field | Type | Description |
|-------|------|-------------|
| boss_result_pk | string | BI#<boss_instance_id> |
| boss_result_sk | string | META |
| boss_instance_id | string | Battle instance UUID |
| created_at | string (ISO) | When results were computed |
| aggregated_by | string | Who/what triggered aggregation |

**Purpose:** Idempotency guard. Prevents duplicate result computation.

### GSIs

**GSI1: Student battle history**
- **PK:** student_id
- **SK:** gsi1_sk (completed_at#boss_instance_id)
- **Purpose:** Student profile, achievement history

**GSI2: Class battle history**
- **PK:** class_id
- **SK:** gsi2_sk (completed_at#boss_instance_id)
- **Purpose:** Teacher analytics, class leaderboards

## Access Patterns

### 1. Fetch full results for a battle
**Query PK:** boss_result_pk = `BI#<boss_instance_id>`
**Returns:** Student rows + guild rows + meta row (single query)
**Use Case:** Teacher recap screen, student summary

### 2. Fetch student's boss battle history
**Query GSI1:** student_id = `<student_id>`, sorted by gsi1_sk
**Returns:** All student result rows across battles
**Use Case:** Student profile, achievement tracking

### 3. Fetch class battle history
**Query GSI2:** class_id = `<class_id>`, sorted by gsi2_sk
**Returns:** All battle results for a class
**Use Case:** Teacher analytics dashboard

## Aggregation Logic

### Compute and Write Results

**Function:** `computeAndWriteBossResults(boss_instance_id)`

**Process:**

1. **Idempotency Check**
   - Check if META row exists
   - If exists, return early (already computed)

2. **Load Battle Instance**
   - Must be COMPLETED or ABORTED
   - Extract outcome, completed_at, fail_reason

3. **Load Participants**
   - Query BossBattleParticipants by boss_instance_id
   - Get state (JOINED, SPECTATE, KICKED, LEFT)
   - Check is_downed flag

4. **Load Attempts**
   - Query BossAnswerAttempts GSI1 by boss_instance_id
   - Group by student_id and guild_id

5. **Aggregate Metrics**
   - **Per Student:**
     - total_correct, total_incorrect, total_attempts
     - total_damage_to_boss (sum of damage_to_boss for correct answers)
     - hearts_lost (sum of abs(hearts_delta_student))
     - last_answered_at (max answered_at)
   - **Per Guild:**
     - guild_total_correct, guild_total_incorrect, guild_total_attempts
     - guild_total_damage_to_boss
     - guild_total_hearts_lost
     - guild_members_joined, guild_members_downed

6. **Load Rewards**
   - Query RewardTransactions GSI3 by source: `SRC#BOSS_BATTLE#<boss_instance_id>`
   - Sum xp_delta and gold_delta per student
   - Aggregate guild totals

7. **Write META Row** (Idempotency Guard)
   - Conditional write: attribute_not_exists(boss_result_pk)
   - If fails (ConditionalCheckFailedException), another process wrote results

8. **Write Student Rows**
   - One row per student
   - Include GSI1 and GSI2 keys

9. **Write Guild Rows**
   - One row per guild
   - Include GSI2 keys (no GSI1 for guilds)

**Idempotency:** Safe to re-run. META row prevents duplicates.

## API Endpoints

### 1. Get Boss Battle Results
**GET** `/boss-battle-instances/{boss_instance_id}/results`

**Authorization:**
- TEACHER: Full results (all students + guilds)
- STUDENT: Own student row + guild row only (TODO: enforce)

**Response (200):**
```json
{
  "outcome": "WIN",
  "completed_at": "2026-02-24T12:30:00.000Z",
  "fail_reason": null,
  "guild_results": [
    {
      "boss_result_pk": "BI#battle-123",
      "boss_result_sk": "GUILD#guild-456",
      "boss_instance_id": "battle-123",
      "class_id": "class-789",
      "boss_template_id": "template-101",
      "outcome": "WIN",
      "completed_at": "2026-02-24T12:30:00.000Z",
      "created_at": "2026-02-24T12:30:05.000Z",
      "guild_id": "guild-456",
      "guild_total_correct": 25,
      "guild_total_incorrect": 5,
      "guild_total_attempts": 30,
      "guild_total_damage_to_boss": 2500,
      "guild_total_hearts_lost": 5,
      "guild_xp_awarded_total": 500,
      "guild_gold_awarded_total": 250,
      "guild_members_joined": 10,
      "guild_members_downed": 0,
      "gsi2_sk": "2026-02-24T12:30:00.000Z#battle-123"
    }
  ],
  "student_results": [
    {
      "boss_result_pk": "BI#battle-123",
      "boss_result_sk": "STU#student-202",
      "boss_instance_id": "battle-123",
      "class_id": "class-789",
      "boss_template_id": "template-101",
      "outcome": "WIN",
      "completed_at": "2026-02-24T12:30:00.000Z",
      "created_at": "2026-02-24T12:30:05.000Z",
      "student_id": "student-202",
      "guild_id": "guild-456",
      "total_correct": 5,
      "total_incorrect": 1,
      "total_attempts": 6,
      "total_damage_to_boss": 500,
      "hearts_lost": 1,
      "xp_awarded": 50,
      "gold_awarded": 25,
      "participation_state": "JOINED",
      "last_answered_at": "2026-02-24T12:28:30.000Z",
      "gsi1_sk": "2026-02-24T12:30:00.000Z#battle-123",
      "gsi2_sk": "2026-02-24T12:30:00.000Z#battle-123",
      "reward_txn_ids": ["txn-303"]
    }
  ]
}
```

### 2. List Student's Boss Battle History
**GET** `/students/{student_id}/bossResults`

**Authorization:** Same student OR teacher/admin authorized for student's classes

**Query Parameters:**
- `limit` (number, optional): Max items (default 50)
- `cursor` (string, optional): Pagination token

**Response (200):**
```json
{
  "items": [
    { /* student result row 1 */ },
    { /* student result row 2 */ }
  ],
  "nextToken": "base64-encoded-cursor"
}
```

### 3. Compute Results (Manual Trigger)
**POST** `/boss-battle-instances/{boss_instance_id}/results/compute`

**Authorization:** TEACHER only

**Request Body:** None

**Response (200):**
```json
{
  "success": true,
  "message": "Boss results computed and written successfully"
}
```

**Response (400 - Already Exists):**
```json
{
  "success": false,
  "message": "Results already exist for this battle"
}
```

## Validation Rules

### Non-Negative Numbers
- total_correct, total_incorrect, total_attempts >= 0
- total_damage_to_boss, hearts_lost >= 0
- xp_awarded, gold_awarded >= 0
- guild_* totals >= 0

### Enums
- **outcome:** WIN | FAIL | ABORTED
- **fail_reason:** TIMEOUT | ALL_GUILDS_DOWN | OUT_OF_QUESTIONS | ABORTED_BY_TEACHER
- **participation_state:** JOINED | SPECTATE | KICKED | LEFT | DOWNED

### Timestamps
- All timestamps must be valid ISO 8601 format

## Integration Points

### Automatic Trigger (Recommended)

When BossBattleInstance transitions to COMPLETED or ABORTED:
1. Battle orchestration handler calls `computeAndWriteBossResults()`
2. Idempotent - safe to call multiple times
3. Results become immediately available

### Manual Trigger

Teacher can manually trigger via API:
```
POST /boss-battle-instances/{boss_instance_id}/results/compute
```

## Testing

Run validation tests:
```bash
cd infra/packages/functions/src/bossResults
node --loader tsx validation.test.ts
```

Run key building tests:
```bash
node --loader tsx keys.test.ts
```

### Test Scenarios

**Test 1: Aggregation correctness**
- Given 10 students, 3 guilds, 50 attempts
- Verify correct sums for damage, hearts, correct/incorrect
- Verify rewards match RewardTransactions ledger

**Test 2: Idempotency**
- Call computeAndWriteBossResults twice
- Second call should return "already exists"
- No duplicate rows created

**Test 3: Authorization (TODO)**
- Teacher can view all results
- Student can only view own + guild results

**Test 4: Pagination**
- List student history with limit=10
- Verify cursor pagination works correctly

## Related Tables/Features

- **BossBattleInstances**: Source of outcome, completed_at, fail_reason
- **BossBattleParticipants**: Source of participation_state, is_downed
- **BossAnswerAttempts**: Source of attempt metrics, damage, hearts deltas
- **RewardTransactions**: Authoritative source for xp_awarded, gold_awarded
- **Guilds**: Guild metadata (name, color, etc.)

---

**Last Updated:** 2026-02-24
**Feature:** Boss Battle Post-Battle Aggregated Summaries

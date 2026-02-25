## BossAnswerAttempts - Combat Log & Immutable Audit Trail

## Overview

BossAnswerAttempts is an **append-only**, immutable combat log that stores every student submission during a boss battle. Each item represents a single answer attempt with full context: timing, speed bonus, damage dealt, hearts lost, and mode metadata. This table supports real-time battle feedback, teacher analytics, auditing, and final aggregation into BossResults.

## Table Schema

**Table Name:** `BossAnswerAttempts`

### Primary Key (Composite)

- **boss_attempt_pk** (string): `BI#<boss_instance_id>#Q#<question_id>`
- **attempt_sk** (string): `T#<answered_at>#S#<student_id>#A#<uuid>`

**Rationale:** Groups all attempts for a specific battle question, sorted by time and student. Allows querying all attempts for a battle+question without scanning. UUID prevents collisions for same-second submissions.

### Core Attributes

| Field | Type | Description |
|-------|------|-------------|
| boss_attempt_pk | string | Primary key (battle + question grouping) |
| attempt_sk | string | Sort key (time + student + UUID) |
| boss_instance_id | string | Boss battle instance UUID |
| class_id | string | Class UUID (for authorization) |
| question_id | string | Question UUID |
| student_id | string | Student UUID |
| guild_id | string | Guild context at submission time |
| answer_raw | map/object | Student's answer (e.g., `{selected_option: "A"}`) |
| is_correct | boolean | Auto-graded correctness |
| answered_at | string (ISO) | Submission timestamp |

### Speed / Timing Attributes

| Field | Type | Description |
|-------|------|-------------|
| elapsed_seconds | number | Time taken to answer (>= 0) |
| effective_time_limit_seconds | number? | Question-specific time limit if set |
| speed_multiplier | number? | Speed bonus multiplier (0..1), null if disabled |

**Speed Bonus Calculation:**
- If `effective_time_limit_seconds` exists: `multiplier = max(floor, 1 - elapsed / effective_time_limit)`
- Else use `speed_window_seconds` from BossBattleInstances config
- Floor is `speed_bonus_floor_multiplier` from instance (e.g., 0.2)

### Effects Attributes

| Field | Type | Description |
|-------|------|-------------|
| damage_to_boss | number | Damage dealt to boss HP (>= 0) |
| hearts_delta_student | number | Student hearts change (<= 0) |
| hearts_delta_guild_total | number | Guild total hearts change (<= 0) |

**Hearts Delta Rules:**
- Correct answer: typically 0 (no penalty)
- Wrong answer: negative (e.g., -1 for student, -3 for guild in TURN_BASED_GUILD)
- These are deltas, not totals

### Auditing Attributes

| Field | Type | Description |
|-------|------|-------------|
| mode_type | enum | SIMULTANEOUS_ALL \| TURN_BASED_GUILD \| RANDOMIZED_PER_GUILD |
| status_at_submit | enum | Battle status when answer submitted (should be QUESTION_ACTIVE) |

### Optional Linkage

| Field | Type | Description |
|-------|------|-------------|
| reward_txn_id | string? | RewardTransactions ID if per-question rewards created |
| auto_grade_result | map/object? | Grading detail (e.g., partial credit breakdown) |

### GSIs

**GSI1: List all attempts by battle**
- **PK:** boss_instance_id
- **SK:** answered_at
- **Purpose:** Teacher live feed, debugging, analytics for entire battle

**GSI2: List all attempts by student**
- **PK:** student_id
- **SK:** answered_at#boss_instance_id#question_id
- **Purpose:** Student history, profile analytics

**GSI3: List attempts by battle + student**
- **PK:** gsi3_pk (boss_instance_id#student_id)
- **SK:** gsi3_sk (answered_at#question_id)
- **Purpose:** Teacher drilldown for specific student in a battle

## Access Patterns

### 1. Query attempts for a battle (teacher live feed)
**Query GSI1:** PK = boss_instance_id, sorted by answered_at
**Use Case:** Real-time battle dashboard, teacher monitoring

### 2. Query attempts for a student (profile/history)
**Query GSI2:** PK = student_id, sorted by answered_at
**Use Case:** Student achievement history, analytics

### 3. Query attempts for a specific battle question (resolve/aggregation)
**Query PK:** boss_attempt_pk = `BI#<battle>#Q#<question>`, sorted by attempt_sk
**Use Case:** Aggregating damage dealt to boss, counting correct answers, determining battle outcome

### 4. Query attempts for a student in a specific battle (teacher drilldown)
**Query GSI3:** PK = gsi3_pk (boss_instance_id#student_id), sorted by gsi3_sk
**Use Case:** Teacher reviewing specific student's performance in a battle

## Append-Only Design

**This table is APPEND-ONLY. No updates allowed.**

- Each submission creates a new immutable item
- Items are never modified or deleted
- Audit trail is preserved forever
- Aggregation happens at read time, not write time

**Idempotency Strategy:**
- Anti-spam enforcement in BossBattleParticipants prevents rapid-fire submissions
- If needed, deterministic ID can be incorporated into attempt_sk suffix
- UUID collision is astronomically unlikely

## API Endpoints

### 1. List Attempts by Battle
**GET** `/boss-battle-instances/{boss_instance_id}/attempts`

**Authorization:** TEACHER, ADMIN only (students cannot see whole-class attempts)

**Query Parameters:**
- `limit` (number, optional): Max items to return (default 50)
- `cursor` (string, optional): Pagination token

**Response (200):**
```json
{
  "items": [
    {
      "boss_attempt_pk": "BI#battle-123#Q#question-456",
      "attempt_sk": "T#2026-02-24T12:00:00.000Z#S#student-789#A#uuid-123",
      "boss_instance_id": "battle-123",
      "class_id": "class-101",
      "question_id": "question-456",
      "student_id": "student-789",
      "guild_id": "guild-202",
      "answer_raw": { "selected_option": "A" },
      "is_correct": true,
      "answered_at": "2026-02-24T12:00:00.000Z",
      "elapsed_seconds": 15.5,
      "effective_time_limit_seconds": 60,
      "speed_multiplier": 0.75,
      "damage_to_boss": 100,
      "hearts_delta_student": 0,
      "hearts_delta_guild_total": 0,
      "mode_type": "SIMULTANEOUS_ALL",
      "status_at_submit": "QUESTION_ACTIVE",
      "gsi2_sk": "2026-02-24T12:00:00.000Z#battle-123#question-456",
      "gsi3_pk": "battle-123#student-789",
      "gsi3_sk": "2026-02-24T12:00:00.000Z#question-456"
    }
  ],
  "nextToken": "base64-encoded-cursor",
  "count": 1
}
```

### 2. List Attempts by Student
**GET** `/students/{student_id}/bossAttempts`

**Authorization:** Same student OR teacher/admin authorized for student's classes

**Query Parameters:**
- `limit` (number, optional): Max items to return (default 50)
- `cursor` (string, optional): Pagination token

**Response (200):**
```json
{
  "items": [ /* same structure as above */ ],
  "nextToken": "base64-encoded-cursor",
  "count": 1
}
```

## Validation Rules

### Create Attempt Input

**Required fields:**
- `boss_instance_id`, `class_id`, `question_id`, `student_id`, `guild_id`: non-empty strings
- `answer_raw`: object/map (not array)
- `is_correct`: boolean
- `elapsed_seconds`: non-negative number
- `damage_to_boss`: non-negative number
- `hearts_delta_student`: non-positive number (<= 0)
- `hearts_delta_guild_total`: non-positive number (<= 0)
- `mode_type`: valid ModeType enum
- `status_at_submit`: valid BattleStatus enum

**Optional fields:**
- `effective_time_limit_seconds`: if provided, integer >= 1
- `speed_multiplier`: if provided, number 0..1
- `reward_txn_id`: string
- `auto_grade_result`: object/map

## Integration with Boss Battle Submission Handler

**Submission Flow:**
1. Student submits answer via boss battle submit handler (to be implemented)
2. Handler validates submission, checks anti-spam fields
3. Handler auto-grades answer using BossQuestions
4. Handler computes:
   - `elapsed_seconds` (now - question_started_at)
   - `speed_multiplier` (using effective_time_limit or speed_window_seconds)
   - `damage_to_boss` (base_points × speed_multiplier if correct, else 0)
   - `hearts_delta_student` (0 if correct, negative penalty if wrong)
   - `hearts_delta_guild_total` (depends on mode_type)
5. Handler calls `createBossAnswerAttempt(...)` to log attempt
6. Handler updates BossBattleInstances.current_boss_hp
7. Handler updates BossBattleParticipants anti-spam fields
8. Handler optionally creates RewardTransactions entry
9. Handler returns result to student

**Important:** Do NOT create a separate "submit" endpoint in this module. Submission logic belongs in the boss battle orchestration handler, which calls `createBossAnswerAttempt()` as a logging step.

## Testing

Run validation tests:
```bash
cd infra/packages/functions/src/bossAnswerAttempts
node --loader tsx validation.test.ts
```

Run key building tests:
```bash
node --loader tsx keys.test.ts
```

### Key Test Scenarios

**Test 1: Build keys correctly**
- `boss_attempt_pk` = `BI#battle-123#Q#question-456`
- `attempt_sk` = `T#2026-02-24T12:00:00.000Z#S#student-789#A#uuid-123`

**Test 2: Validate elapsed_seconds >= 0**
- Accept: 0, 10.5, 60
- Reject: -5

**Test 3: Validate effective_time_limit_seconds >= 1 or undefined**
- Accept: 1, 60, undefined
- Reject: 0, -10, 5.5 (non-integer)

**Test 4: Validate speed_multiplier 0..1 or undefined**
- Accept: 0, 0.5, 1, undefined
- Reject: -0.1, 1.5

**Test 5: Validate hearts deltas <= 0**
- Accept: 0, -1, -5
- Reject: 5 (positive)

**Test 6: Validate mode_type and status_at_submit enums**
- Accept valid enums
- Reject invalid values

## Related Tables/Features

- **BossBattleInstances**: State machine, controls when submissions are allowed
- **BossBattleParticipants**: Anti-spam enforcement, tracks who is in battle
- **BossQuestions**: Auto-grading logic, base damage values
- **PlayerStates**: Hearts tracking (updated based on hearts deltas)
- **RewardTransactions**: Immutable ledger for XP/gold/hearts rewards

---

**Last Updated:** 2026-02-24
**Feature:** Boss Battle Combat Log & Immutable Audit Trail

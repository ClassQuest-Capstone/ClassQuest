## BossBattleInstances - State Machine & Documentation

## Overview

BossBattleInstances is the authoritative state machine for live boss battles. Each instance represents a single boss battle session, tracking its lifecycle from draft/setup through to completion or abort.

## Table Schema

**Table Name:** `BossBattleInstances`

### Primary Key
- **boss_instance_id** (string): UUID

### GSI1: class_id + created_at
- **PK:** class_id (string)
- **SK:** created_at (string ISO)
- **Purpose:** List all battles for a specific class

### GSI2: boss_template_id + created_at
- **PK:** boss_template_id (string)
- **SK:** created_at (string ISO)
- **Purpose:** List all instances of a specific template (analytics)

## Status Lifecycle

The battle progresses through these states:

```
DRAFT → LOBBY → COUNTDOWN → QUESTION_ACTIVE → RESOLVING → INTERMISSION
                                    ↓
                            [back to QUESTION_ACTIVE or INTERMISSION]
                                    ↓
                          COMPLETED or ABORTED
```

### Status Descriptions

| Status | Description |
|--------|-------------|
| **DRAFT** | Initial state. Teacher is setting up the battle. Not visible to students. |
| **LOBBY** | Students can join. Waiting for teacher to start countdown. |
| **COUNTDOWN** | Pre-battle countdown (e.g., 10 seconds). No actions allowed. |
| **QUESTION_ACTIVE** | A question is currently active. Students can submit answers. |
| **RESOLVING** | Question time expired or all students answered. System processes results. |
| **INTERMISSION** | Brief pause between questions. Shows results/damage dealt. |
| **COMPLETED** | Battle finished (boss defeated or all questions answered). |
| **ABORTED** | Battle was terminated by teacher or system error. |

## Mode Types

### SIMULTANEOUS_ALL
All students answer the same question at the same time. Most common mode.

### TURN_BASED_GUILD
One guild answers at a time. Uses `turn_policy` to determine guild order.

### RANDOMIZED_PER_GUILD
Each guild gets a randomized question sequence. Uses `per_guild_question_index` map.

## Core Attributes

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| boss_instance_id | string | UUID primary key |
| class_id | string | Class this battle belongs to |
| boss_template_id | string | Template defining questions/boss stats |
| created_by_teacher_id | string | Teacher who created the instance |
| status | BossBattleStatus | Current lifecycle status |
| mode_type | ModeType | How students participate |
| question_selection_mode | QuestionSelectionMode | ORDERED or RANDOM_NO_REPEAT |
| initial_boss_hp | number | Boss HP at start (from template) |
| current_boss_hp | number | Current boss HP (decreases as students answer correctly) |

### Speed Bonus Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| speed_bonus_enabled | boolean | true | Whether to award speed bonuses |
| speed_bonus_floor_multiplier | number | 0.2 | Minimum multiplier (0.0-1.0) |
| speed_window_seconds | number | 30 | Time window for speed calculation |
| time_limit_seconds_default | number? | - | Default time limit (overridden by per-question limits) |

**Speed Bonus Formula:**
```
multiplier = max(floor_multiplier, 1 - (time_taken / speed_window_seconds))
bonus_damage = base_damage * multiplier
```

### Anti-Spam & Penalties

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| anti_spam_min_submit_interval_ms | number | 1500 | Min time between submissions (ms) |
| freeze_on_wrong_seconds | number | 3 | Penalty freeze time for wrong answers |
| late_join_policy | LateJoinPolicy | DISALLOW_AFTER_COUNTDOWN | Late join behavior |

### Timing / Lifecycle Fields (Optional)

All timestamps are ISO 8601 strings:

- `lobby_opened_at`: When lobby was opened
- `countdown_seconds`: Countdown duration
- `countdown_end_at`: When countdown expires
- `active_question_id`: Current question UUID
- `question_started_at`: When current question started
- `question_ends_at`: When current question expires (null for untimed)
- `intermission_ends_at`: When intermission ends
- `completed_at`: When battle completed

### Question Management

| Field | Type | Description |
|-------|------|-------------|
| current_question_index | number | Current question index (0-based) |
| per_guild_question_index | Record<string, number> | Per-guild indices (RANDOMIZED_PER_GUILD mode) |
| active_guild_id | string? | Current guild (TURN_BASED_GUILD mode) |
| turn_policy | TurnPolicy? | How turns rotate (ROUND_ROBIN, RANDOM_NEXT_GUILD, TEACHER_SELECTS_NEXT) |

### Plans & Snapshots (Pointers)

These are UUIDs pointing to other tables/documents:

- `participants_snapshot_id`: Snapshot of enrolled students at battle start
- `question_plan_id`: Ordered list of question IDs for this battle
- `guild_question_plan_id`: Per-guild question plans (if applicable)

### Outcome (Set on Completion)

| Field | Type | Values |
|-------|------|--------|
| outcome | BattleOutcome? | WIN, FAIL, ABORTED |
| fail_reason | FailReason? | TIMEOUT, ALL_GUILDS_DOWN, OUT_OF_QUESTIONS, ABORTED_BY_TEACHER |

## API Endpoints

### 1. Create Boss Battle Instance
**POST** `/boss-battle-instances`

**Authorization:** TEACHER, ADMIN only

**Request Body:**
```json
{
  "class_id": "class-uuid",
  "boss_template_id": "template-uuid",
  "initial_boss_hp": 1000,
  "mode_type": "SIMULTANEOUS_ALL",
  "question_selection_mode": "ORDERED",
  "speed_bonus_enabled": true,
  "speed_bonus_floor_multiplier": 0.2,
  "speed_window_seconds": 30,
  "time_limit_seconds_default": 60,
  "anti_spam_min_submit_interval_ms": 1500,
  "freeze_on_wrong_seconds": 3,
  "late_join_policy": "DISALLOW_AFTER_COUNTDOWN",
  "turn_policy": "ROUND_ROBIN"
}
```

**Defaults Applied:**
- `status`: DRAFT
- `mode_type`: SIMULTANEOUS_ALL
- `question_selection_mode`: ORDERED
- `speed_bonus_enabled`: true
- `speed_bonus_floor_multiplier`: 0.2
- `speed_window_seconds`: 30
- `anti_spam_min_submit_interval_ms`: 1500
- `freeze_on_wrong_seconds`: 3
- `late_join_policy`: DISALLOW_AFTER_COUNTDOWN
- `current_question_index`: 0
- `current_boss_hp`: initial_boss_hp

**Response (201):**
```json
{
  "message": "Boss battle instance created successfully",
  "boss_instance_id": "uuid",
  "status": "DRAFT"
}
```

### 2. Get Boss Battle Instance
**GET** `/boss-battle-instances/{boss_instance_id}`

**Authorization:**
- TEACHER, ADMIN: always allowed
- STUDENT: only if enrolled in class AND status != DRAFT

**Response (200):**
```json
{
  "boss_instance_id": "uuid",
  "class_id": "class-uuid",
  "boss_template_id": "template-uuid",
  "created_by_teacher_id": "teacher-uuid",
  "status": "LOBBY",
  "mode_type": "SIMULTANEOUS_ALL",
  "question_selection_mode": "ORDERED",
  "initial_boss_hp": 1000,
  "current_boss_hp": 1000,
  "speed_bonus_enabled": true,
  "speed_bonus_floor_multiplier": 0.2,
  "speed_window_seconds": 30,
  "anti_spam_min_submit_interval_ms": 1500,
  "freeze_on_wrong_seconds": 3,
  "late_join_policy": "DISALLOW_AFTER_COUNTDOWN",
  "current_question_index": 0,
  "created_at": "2026-02-24T12:00:00.000Z",
  "updated_at": "2026-02-24T12:00:00.000Z"
}
```

### 3. List Boss Battle Instances by Class
**GET** `/classes/{class_id}/boss-battle-instances`

**Authorization:** TEACHER, ADMIN, or students enrolled in class

**Query Parameters:**
- `limit` (number, optional)
- `cursor` (string, optional)

**Response (200):**
```json
{
  "items": [
    { /* battle instance 1 */ },
    { /* battle instance 2 */ }
  ],
  "cursor": "base64-encoded-cursor"
}
```

### 4. List Boss Battle Instances by Template
**GET** `/boss-battle-templates/{boss_template_id}/boss-battle-instances`

**Authorization:** TEACHER, ADMIN only (analytics)

**Query Parameters:**
- `limit` (number, optional)
- `cursor` (string, optional)

**Response (200):**
```json
{
  "items": [
    { /* battle instance 1 */ },
    { /* battle instance 2 */ }
  ],
  "cursor": "base64-encoded-cursor"
}
```

### 5. Update Boss Battle Instance
**PATCH** `/boss-battle-instances/{boss_instance_id}`

**Authorization:** TEACHER, ADMIN only

**Request Body (all fields optional):**
```json
{
  "status": "LOBBY",
  "current_boss_hp": 950,
  "lobby_opened_at": "2026-02-24T12:05:00.000Z",
  "countdown_seconds": 10,
  "countdown_end_at": "2026-02-24T12:05:10.000Z",
  "active_question_id": "question-uuid",
  "question_started_at": "2026-02-24T12:05:15.000Z",
  "question_ends_at": "2026-02-24T12:06:15.000Z",
  "intermission_ends_at": "2026-02-24T12:06:25.000Z",
  "current_question_index": 1,
  "per_guild_question_index": {
    "guild-1": 2,
    "guild-2": 3
  },
  "active_guild_id": "guild-1",
  "outcome": "WIN",
  "fail_reason": null,
  "participants_snapshot_id": "snapshot-uuid",
  "question_plan_id": "plan-uuid",
  "guild_question_plan_id": "guild-plan-uuid",
  "completed_at": "2026-02-24T12:30:00.000Z"
}
```

**Response (200):**
```json
{
  "message": "Boss battle instance updated successfully",
  "boss_instance_id": "uuid",
  "updated_at": "2026-02-24T12:00:00.000Z"
}
```

## Validation Rules

### Create Validation
- `class_id`: required, non-empty string
- `boss_template_id`: required, non-empty string
- `created_by_teacher_id`: required, non-empty string
- `initial_boss_hp`: required, integer >= 1
- `mode_type`: must be valid ModeType enum
- `question_selection_mode`: must be valid QuestionSelectionMode enum
- `speed_bonus_floor_multiplier`: number 0.0 to 1.0
- `speed_window_seconds`: non-negative number
- `anti_spam_min_submit_interval_ms`: non-negative number
- `freeze_on_wrong_seconds`: non-negative number
- `late_join_policy`: must be valid LateJoinPolicy enum
- `turn_policy`: must be valid TurnPolicy enum

### Update Validation
- `status`: must be valid BossBattleStatus enum
- `current_boss_hp`: non-negative integer (0 = boss defeated)
- `current_question_index`: non-negative integer
- `outcome`: must be valid BattleOutcome enum
- `fail_reason`: must be valid FailReason enum
- All timestamps: must be valid ISO 8601 strings

## Frontend Usage

**Location:** `app/frontend/src/api/bossBattleInstances/client.ts`

```typescript
import {
  createBossBattleInstance,
  getBossBattleInstance,
  listBossBattleInstancesByClass,
  listBossBattleInstancesByTemplate,
  updateBossBattleInstance,
} from './api/bossBattleInstances/client';

// Create a battle
const result = await createBossBattleInstance({
  class_id: 'class-123',
  boss_template_id: 'template-456',
  initial_boss_hp: 1000,
  mode_type: 'SIMULTANEOUS_ALL',
});

// Get a battle
const battle = await getBossBattleInstance('battle-uuid');

// List battles by class
const battles = await listBossBattleInstancesByClass('class-123', { limit: 10 });

// Update battle status
await updateBossBattleInstance('battle-uuid', {
  status: 'LOBBY',
  lobby_opened_at: new Date().toISOString(),
});
```

## Testing

Run validation tests:
```bash
cd infra/packages/functions/src/bossBattleInstances
node --loader tsx validation.test.ts
```

## Related Tables/Features
- **BossBattleTemplates**: Defines boss stats, questions, and rewards
- **BossQuestions**: Individual questions in a template
- **ClassEnrollments**: Determines which students can participate
- **Guilds**: Team assignments for collaborative battles
- **RewardTransactions**: Records XP/gold/hearts earned during battle

---

**Last Updated:** 2026-02-24
**Feature:** Boss Battle State Machine

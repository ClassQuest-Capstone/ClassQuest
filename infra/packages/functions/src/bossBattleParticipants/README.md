## BossBattleParticipants - Participation Tracking & Lobby Management

## Overview

BossBattleParticipants is the authoritative record of which students joined a specific boss battle instance, which guild they are in for that battle, and per-student cooldown/freeze/downed flags. This table supports lobby management, participation tracking, and anti-spam enforcement.

## Table Schema

**Table Name:** `BossBattleParticipants`

### Primary Key (Composite)
- **boss_instance_id** (string): Boss battle instance UUID
- **student_id** (string): Student UUID

### Attributes

| Field | Type | Description |
|-------|------|-------------|
| boss_instance_id | string | Boss battle instance (PK) |
| student_id | string | Student ID (SK) |
| class_id | string | Denormalized for auth checks + GSI queries |
| guild_id | string | Guild context at join time |
| state | ParticipantState | JOINED \| SPECTATE \| KICKED \| LEFT |
| joined_at | string (ISO) | First join timestamp |
| updated_at | string (ISO) | Last update timestamp |

### Anti-Spam & Gameplay Flags

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| last_submit_at | string (ISO)? | - | Last answer submission timestamp (set internally by SubmitBossAnswer) |
| frozen_until | string (ISO)? | - | Freeze expiration timestamp (set internally by SubmitBossAnswer on wrong-answer penalty) |
| is_downed | boolean | false | Player is downed (out of hearts — set internally by ResolveQuestion) |
| downed_at | string (ISO)? | - | When player was downed (set internally by ResolveQuestion) |
| kick_reason | string? | - | Reason for kick (if state = KICKED) |

### GSIs

**GSI1: List participants by instance (optional convenience)**
- **PK:** boss_instance_id
- **SK:** joined_at
- **Purpose:** List all participants in a battle sorted by join time

**GSI2: List participants by class (internal use only)**
- **PK:** class_id
- **SK:** gsi2_sk (boss_instance_id#student_id)
- **Purpose:** Server-side queries across all battles in a class (not exposed as a public endpoint)

## Participant States

| State | Description |
|-------|-------------|
| **JOINED** | Actively participating in the battle. Can answer questions. |
| **SPECTATE** | Joined late or manually set to spectate. Cannot answer questions. |
| **KICKED** | Removed by teacher. Cannot rejoin unless un-kicked. |
| **LEFT** | Voluntarily left. Can rejoin only during LOBBY phase. |

## Joining Rules (Enforced in join.ts)

### LOBBY Status
- Students may join with state = **JOINED**
- Students with state = LEFT may rejoin

### COUNTDOWN/QUESTION_ACTIVE/RESOLVING/INTERMISSION Status
- If `late_join_policy = ALLOW_SPECTATE`:
  - Student joins with state = **SPECTATE**
- If `late_join_policy = DISALLOW_AFTER_COUNTDOWN`:
  - Reject join request with error

### COMPLETED/ABORTED Status
- Reject join request

### Kick Enforcement
- Students with state = KICKED cannot rejoin
- Teacher must manually un-kick (not implemented yet)

---

## Public API Endpoints

The following 5 endpoints are routed in QuestApiStack and dispatched via the quest-router Lambda. These are the **only** publicly exposed HTTP operations for this module.

### 1. Join Boss Battle
**POST** `/boss-battle-instances/{boss_instance_id}/participants/join`

**Handler:** `bossBattleParticipants/join.ts`

**Authorization:** STUDENT only (JWT sub extracted from token)

**Request Body:**
```json
{
  "guild_id": "guild-uuid"
}
```

**Behavior:**
- Checks BossBattleInstances.status and late_join_policy
- Enforces joining rules (see above)
- Rejects if student was kicked
- Preserves joined_at if re-joining

**Response (200):**
```json
{
  "message": "Successfully joined the battle",
  "state": "JOINED"
}
```

**Response (200 - Late Join):**
```json
{
  "message": "Battle already started. You have been added as a spectator.",
  "state": "SPECTATE"
}
```

**Response (400 - Rejected):**
```json
{
  "error": "Cannot join battle after countdown has started"
}
```

### 2. Spectate Boss Battle
**POST** `/boss-battle-instances/{boss_instance_id}/participants/spectate`

**Handler:** `bossBattleParticipants/spectate.ts`

**Authorization:** STUDENT only

**Request Body:** None

**Response (200):**
```json
{
  "message": "Successfully set to spectate mode"
}
```

### 3. Leave Boss Battle
**POST** `/boss-battle-instances/{boss_instance_id}/participants/leave`

**Handler:** `bossBattleParticipants/leave.ts`

**Authorization:** STUDENT only

**Request Body:** None

**Response (200):**
```json
{
  "message": "Successfully left the battle"
}
```

### 4. List Participants
**GET** `/boss-battle-instances/{boss_instance_id}/participants`

**Handler:** `bossBattleParticipants/list.ts`

**Authorization:**
- TEACHER: Full list
- STUDENT: Limited list (privacy policy applies — not enforced yet)

**Query Parameters:**
- `state` (ParticipantState, optional): Filter by state

**Response (200):**
```json
{
  "items": [
    {
      "boss_instance_id": "battle-uuid",
      "student_id": "student-uuid",
      "class_id": "class-uuid",
      "guild_id": "guild-uuid",
      "state": "JOINED",
      "joined_at": "2026-02-24T12:00:00.000Z",
      "updated_at": "2026-02-24T12:00:00.000Z",
      "is_downed": false,
      "gsi2_sk": "battle-uuid#student-uuid"
    }
  ],
  "count": 1
}
```

### 5. Kick Participant
**POST** `/boss-battle-instances/{boss_instance_id}/participants/{student_id}/kick`

**Handler:** `bossBattleParticipants/kick.ts`

**Authorization:** TEACHER only

**Request Body (optional):**
```json
{
  "reason": "Inappropriate behavior"
}
```

**Response (200):**
```json
{
  "message": "Successfully kicked student student-uuid from battle"
}
```

---

## Internal Repository Operations

The following functions in `repo.ts` are **not** exposed as HTTP endpoints. They are called by other server-side services as part of boss battle orchestration. Do not add them to the API stack or generate frontend client functions for them.

| Function | Called By | Purpose |
|----------|-----------|---------|
| `getParticipant(bossInstanceId, studentId)` | `join.ts`, `upsertParticipantJoin()` | Fetch a single participant record for pre-join checks and upsert logic |
| `markParticipantDowned(bossInstanceId, studentId)` | `bossBattleInstances/resolve-question.ts` | Set `is_downed = true` when a student's hearts reach 0 during question resolution |
| `updateAntiSpamFields(bossInstanceId, studentId, fields)` | `bossBattleInstances/submit-answer.ts` | Write `last_submit_at` and `frozen_until` after each answer submission |
| `listParticipantsByClass(classId)` | (reserved for server-side teacher/admin services) | Query GSI2 to list all participants across all battles in a class |

These functions remain in `repo.ts` for use by boss battle orchestration logic. If a public endpoint is needed in the future, a dedicated route handler file and QuestApiStack route entry must be added, with appropriate auth enforcement.

---

## Validation Rules

### Join Input
- `boss_instance_id`: required, non-empty string
- `student_id`: required, non-empty string (extracted from JWT)
- `class_id`: required, non-empty string
- `guild_id`: required, non-empty string

### State
- Must be one of: JOINED, SPECTATE, KICKED, LEFT

### Timestamps
- Must be valid ISO 8601 format (e.g., 2026-02-24T12:00:00.000Z)

## Anti-Spam Support

Anti-spam fields are written internally by server-side services and are never accepted directly from client requests.

**Fields (internal, set server-side only):**
- `last_submit_at`: Written by `submit-answer.ts` after each valid submission for rate limiting
- `frozen_until`: Written by `submit-answer.ts` as a penalty freeze on wrong answers (`now + freeze_on_wrong_seconds`)
- `is_downed`: Written by `resolve-question.ts` when a student's hearts reach 0

## Frontend Usage

Only the 5 public endpoints above have corresponding client functions. Internal operations (`markParticipantDowned`, `updateAntiSpamFields`, `listParticipantsByClass`) have no frontend client counterparts.

**Location:** `app/frontend/src/api/bossBattleParticipants/client.ts`

```typescript
import {
  joinBossBattle,
  spectateBossBattle,
  leaveBossBattle,
  listBossBattleParticipants,
  kickParticipant,
} from './api/bossBattleParticipants/client';

// Join a battle
const result = await joinBossBattle('battle-123', { guild_id: 'guild-456' });
console.log(result.state); // "JOINED" or "SPECTATE"

// Leave a battle
await leaveBossBattle('battle-123');

// List participants
const participants = await listBossBattleParticipants('battle-123', {
  state: 'JOINED',
});
console.log(participants.items);

// Kick a participant (teacher only)
await kickParticipant('battle-123', 'student-456', {
  reason: 'Inappropriate behavior',
});
```

## Testing

Run validation tests:
```bash
cd infra/packages/functions/src/bossBattleParticipants
node --import tsx validation.test.ts
```

### Join Logic Test Scenarios

**Test 1: Join allowed in LOBBY**
- BossBattleInstances.status = LOBBY
- Result: state = JOINED

**Test 2: Join blocked in COUNTDOWN with DISALLOW_AFTER_COUNTDOWN**
- BossBattleInstances.status = COUNTDOWN
- BossBattleInstances.late_join_policy = DISALLOW_AFTER_COUNTDOWN
- Result: 400 error "Cannot join battle after countdown has started"

**Test 3: Join becomes SPECTATE in COUNTDOWN with ALLOW_SPECTATE**
- BossBattleInstances.status = COUNTDOWN
- BossBattleInstances.late_join_policy = ALLOW_SPECTATE
- Result: state = SPECTATE, message includes "spectator"

**Test 4: Kicked student cannot rejoin**
- Student previously kicked (state = KICKED)
- Result: 500 error "was kicked from battle"

**Test 5: Left student can rejoin during LOBBY**
- Student previously left (state = LEFT)
- BossBattleInstances.status = LOBBY
- Result: state = JOINED, joined_at preserved

## Related Tables/Features

- **BossBattleInstances**: Battle state machine, controls join eligibility via status + late_join_policy
- **PlayerStates**: Guild HP derived from sum of hearts for JOINED participants
- **Guilds**: Team assignments for collaborative battles
- **BossQuestions**: Questions that participants answer during battle

---

**Last Updated:** 2026-03-11
**Feature:** Boss Battle Participation & Lobby Management

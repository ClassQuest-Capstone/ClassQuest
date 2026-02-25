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
| last_submit_at | string (ISO)? | - | Last answer submission timestamp |
| frozen_until | string (ISO)? | - | Freeze expiration timestamp (penalty) |
| is_downed | boolean | false | Player is downed (out of hearts) |
| downed_at | string (ISO)? | - | When player was downed |
| kick_reason | string? | - | Reason for kick (if state = KICKED) |

### GSIs

**GSI1: List participants by instance (optional convenience)**
- **PK:** boss_instance_id
- **SK:** joined_at
- **Purpose:** List all participants in a battle sorted by join time

**GSI2: List participants by class (required for teacher views)**
- **PK:** class_id
- **SK:** gsi2_sk (boss_instance_id#student_id)
- **Purpose:** Teacher can view active lobbies and participants across all battles in a class

## Participant States

| State | Description |
|-------|-------------|
| **JOINED** | Actively participating in the battle. Can answer questions. |
| **SPECTATE** | Joined late or manually set to spectate. Cannot answer questions. |
| **KICKED** | Removed by teacher. Cannot rejoin unless un-kicked. |
| **LEFT** | Voluntarily left. Can rejoin only during LOBBY phase. |

## Access Patterns

### 1. List all participants in a battle
**Query:** PK = boss_instance_id
**Filter (optional):** state = JOINED/SPECTATE
**Use Case:** Display lobby roster, count active participants

### 2. Get a single participant record
**GetItem:** (boss_instance_id, student_id)
**Use Case:** Check if student is already joined, verify state

### 3. Teacher: list participants by class
**Query GSI2:** PK = class_id
**Use Case:** Admin dashboard showing active battles and participants

### 4. Update participant state on join/leave/kick
**UpdateItem:** (boss_instance_id, student_id)
**Use Case:** State transitions as students interact with the battle

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

## API Endpoints

### 1. Join Boss Battle
**POST** `/boss-battle-instances/{boss_instance_id}/participants/join`

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

**Authorization:**
- TEACHER: Full list
- STUDENT: Limited list (privacy policy applies - not enforced yet)

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

### Anti-Spam Fields
- `last_submit_at`: optional ISO 8601 timestamp
- `frozen_until`: optional ISO 8601 timestamp

## Anti-Spam Support

The table stores anti-spam fields but does NOT enforce submit logic. Enforcement happens in answer submission handlers (to be implemented later).

**Fields:**
- `last_submit_at`: Track last submission time for rate limiting
- `frozen_until`: Penalty freeze timestamp for wrong answers
- `is_downed`: Player ran out of hearts (cannot answer)

**Future Integration:**
- Answer submission handler checks `frozen_until` before accepting answer
- Answer submission handler updates `last_submit_at`
- Wrong answer penalty sets `frozen_until = now + freeze_on_wrong_seconds`
- Heart depletion sets `is_downed = true`

## Frontend Usage

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
node --loader tsx validation.test.ts
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

**Last Updated:** 2026-02-24
**Feature:** Boss Battle Participation & Lobby Management

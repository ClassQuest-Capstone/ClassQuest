## BossBattleSnapshots - Immutable Participation Snapshots

## Overview

BossBattleSnapshots stores **immutable snapshots** of battle participation taken at key moments (especially when countdown starts). This ensures the roster is deterministic, late joins don't affect guild HP/scoring, and results are reproducible for auditing. BossBattleInstances references these snapshots via `participants_snapshot_id`.

## Table Schema

**Table Name:** `BossBattleSnapshots`

### Primary Key

- **snapshot_id** (string): ULID/UUID

### Attributes

| Field | Type | Description |
|-------|------|-------------|
| snapshot_id | string | Primary key (ULID/UUID) |
| boss_instance_id | string | Battle instance UUID |
| class_id | string | Class UUID |
| created_by_teacher_id | string | Teacher who created snapshot |
| created_at | string (ISO) | Snapshot creation timestamp |
| joined_students | list<map> | Array of participant entries |
| joined_count | number | Count of joined students (must match list length) |
| guild_counts | map<string, number> | guild_id -> count |
| version | number | Schema version (starts at 1) |
| participants_hash | string? | Optional hash for change detection |

### Joined Students Entry

Each entry in `joined_students` array:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| student_id | string | Yes | Student UUID |
| guild_id | string | Yes | Guild UUID at battle time |
| display_name | string | No | Optional display name (if privacy allows) |
| username | string | No | Optional username (if privacy allows) |

### GSIs

**GSI1: List snapshots by battle (debugging)**
- **PK:** boss_instance_id
- **SK:** created_at
- **Purpose:** Debug view, multiple snapshots per battle

## Access Patterns

### 1. Create snapshot at countdown start
**Function:** `createParticipantsSnapshot()`
**Steps:**
1. Load BossBattleInstance (require status == LOBBY or COUNTDOWN)
2. Query BossBattleParticipants where state=JOINED
3. Build snapshot with joined_students, joined_count, guild_counts
4. Write snapshot to table
5. Update BossBattleInstances.participants_snapshot_id (conditional)

**Use Case:** Freeze roster when battle countdown begins

### 2. Read snapshot by ID
**Function:** `getSnapshot(snapshot_id)`
**Use Case:** Retrieve frozen roster for scoring, results computation

### 3. List snapshots by battle (debugging)
**Function:** `listSnapshotsByInstance(boss_instance_id)`
**GSI:** GSI1
**Use Case:** Debug view showing all snapshots for a battle

## Snapshot Creation Logic

### `createParticipantsSnapshot()`

**Input:**
```typescript
{
  boss_instance_id: string;
  created_by_teacher_id: string;
}
```

**Process:**

1. **Load BossBattleInstance**
   - Validate exists
   - Require status == LOBBY or COUNTDOWN

2. **Query Participants**
   - Query BossBattleParticipants by boss_instance_id
   - Filter: state = JOINED only
   - Exclude: SPECTATE, KICKED, LEFT

3. **Build Snapshot Payload**
   ```typescript
   joined_students = participants.map(p => ({
     student_id: p.student_id,
     guild_id: p.guild_id,
     // Optional: display_name, username
   }))

   joined_count = joined_students.length

   guild_counts = {}
   for (participant of joined_students) {
     guild_counts[participant.guild_id]++
   }
   ```

4. **Write Snapshot**
   - Generate snapshot_id (UUID)
   - Set version = 1
   - PutItem to BossBattleSnapshots

5. **Update Battle Instance (Conditional)**
   - UpdateItem: SET participants_snapshot_id = snapshot_id
   - Condition: `attribute_not_exists(participants_snapshot_id) OR status = 'LOBBY'`
   - **Idempotency:** If condition fails, snapshot already exists

**Returns:** `BossBattleSnapshot`

**Error Cases:**
- Battle not found → throw error
- Battle status not LOBBY/COUNTDOWN → throw error
- Snapshot already exists (condition fails) → throw "already exists"

## API Endpoints

### 1. Create Participants Snapshot
**POST** `/boss-battle-instances/{boss_instance_id}/snapshots/participants`

**Authorization:** TEACHER only

**Request Body:** None (uses teacher_id from JWT)

**Response (201):**
```json
{
  "message": "Participants snapshot created successfully",
  "snapshot_id": "550e8400-e29b-41d4-a716-446655440000",
  "joined_count": 15,
  "guild_counts": {
    "guild-A": 8,
    "guild-B": 7
  }
}
```

**Response (400 - Already Exists):**
```json
{
  "error": "Snapshot already exists for this battle or battle is no longer in LOBBY"
}
```

### 2. Get Snapshot by ID
**GET** `/boss-battle-snapshots/{snapshot_id}`

**Authorization:** TEACHER only (or students if showing roster)

**Response (200):**
```json
{
  "snapshot_id": "550e8400-e29b-41d4-a716-446655440000",
  "boss_instance_id": "battle-123",
  "class_id": "class-456",
  "created_by_teacher_id": "teacher-789",
  "created_at": "2026-02-24T12:00:00.000Z",
  "joined_students": [
    {
      "student_id": "student-101",
      "guild_id": "guild-A"
    },
    {
      "student_id": "student-102",
      "guild_id": "guild-A"
    },
    {
      "student_id": "student-103",
      "guild_id": "guild-B"
    }
  ],
  "joined_count": 3,
  "guild_counts": {
    "guild-A": 2,
    "guild-B": 1
  },
  "version": 1
}
```

**Response (404):**
```json
{
  "error": "Snapshot not found"
}
```

## Validation Rules

### Participant Entry
- `student_id`: required, non-empty string
- `guild_id`: required, non-empty string
- `display_name`, `username`: optional strings

### Joined Students
- Must be array (can be empty)
- Each entry must be valid participant

### Joined Count
- Must be non-negative number
- Must match `joined_students.length`

### Guild Counts
- Must be object/map
- Each guild in `joined_students` must have correct count
- No extra guilds allowed

## Integration Points

### Countdown Start Handler

**Recommended Flow:**

```typescript
async function startCountdown(bossInstanceId: string, teacherId: string) {
  // 1. Create snapshot (captures current JOINED participants)
  const snapshot = await createParticipantsSnapshot({
    boss_instance_id: bossInstanceId,
    created_by_teacher_id: teacherId,
  });

  // 2. Update battle status to COUNTDOWN
  await updateBattleStatus(bossInstanceId, "COUNTDOWN", {
    countdown_seconds: 10,
    countdown_end_at: /* now + 10 seconds */,
  });

  // 3. Notify clients via WebSocket
  // ...
}
```

**Note:** The snapshot update to BossBattleInstances.participants_snapshot_id happens automatically inside `createParticipantsSnapshot()`.

### Using Snapshot for Scoring

```typescript
// When computing guild HP or final results
const instance = await getBossBattleInstance(bossInstanceId);
const snapshot = await getSnapshot(instance.participants_snapshot_id);

// Use snapshot.joined_students instead of querying live participants
for (const participant of snapshot.joined_students) {
  // Compute HP, damage, etc. based on frozen roster
}
```

## Testing

Run validation tests:
```bash
cd infra/packages/functions/src/bossBattleSnapshots
node --loader tsx validation.test.ts
```

### Test Scenarios

**Test 1: Snapshot creation with 3 JOINED participants**
- Creates snapshot with joined_count=3
- Correct guild_counts (e.g., guild-A: 2, guild-B: 1)
- Does NOT include SPECTATE/LEFT/KICKED participants

**Test 2: Idempotency - second snapshot attempt**
- First snapshot succeeds
- Second attempt throws "already exists"
- BossBattleInstances.participants_snapshot_id unchanged

**Test 3: Authorization**
- TEACHER can create snapshot
- STUDENT cannot create snapshot (401/403)

**Test 4: Status validation**
- LOBBY status → allowed
- COUNTDOWN status → allowed
- QUESTION_ACTIVE status → rejected

**Test 5: Validation**
- Empty joined_students → allowed (battle might start with 0)
- Mismatched joined_count → rejected
- Wrong guild_counts → rejected

## Why Snapshots?

### Problem: Live Participation Changes

Without snapshots:
- Late joins during countdown could add to guild HP
- Students leaving mid-battle would affect scoring
- Results would be non-reproducible (participants changed)
- BossBattleInstances would need large `participants` array, rewritten often

### Solution: Immutable Snapshots

With snapshots:
✅ **Deterministic roster** - frozen at countdown start
✅ **Late join handling** - can spectate but not affect scoring
✅ **Reproducible results** - snapshot referenced in BossResults
✅ **Small BossBattleInstances** - only stores snapshot_id reference
✅ **Auditable** - can replay battle with exact participant list

## Related Tables/Features

- **BossBattleInstances**: Stores participants_snapshot_id reference
- **BossBattleParticipants**: Live lobby state (source for snapshot)
- **BossResults**: Uses snapshot to compute final results
- **BossAnswerAttempts**: Validates attempts against snapshot roster

---

**Last Updated:** 2026-02-24
**Feature:** Boss Battle Immutable Participation Snapshots

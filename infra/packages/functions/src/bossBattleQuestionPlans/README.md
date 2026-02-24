# BossBattleQuestionPlans

Deterministic question sequence generation for boss battles.

## Overview

BossBattleQuestionPlans stores pre-generated question sequences for each boss battle instance. Plans are created at **countdown start** to ensure:

1. **Determinism**: Same seed always produces same question order
2. **Fairness**: All participants face questions in predetermined order
3. **Auditability**: Question sequences can be reproduced for analysis
4. **Per-Guild Randomization**: Each guild can face different question orders (mode-dependent)

## Table Schema

### Primary Key
- **PK**: `plan_id` (string, ULID/UUID)

### Global Secondary Indexes
- **GSI1**: `boss_instance_id` (PK) → `created_at` (SK)
  - Purpose: List all plans for a battle instance (debugging)

### Attributes

#### Common Fields (All Plans)
```typescript
{
  plan_id: string;                       // PK: unique plan ID
  boss_instance_id: string;              // FK to BossBattleInstances
  class_id: string;                      // FK to Classes
  boss_template_id: string;              // FK to BossTemplates
  mode_type: ModeType;                   // Battle mode (see below)
  question_selection_mode: QuestionSelectionMode; // Order mode (see below)
  created_by_teacher_id: string;         // Teacher who started countdown
  created_at: string;                    // ISO timestamp
  version: number;                       // Schema version (currently 1)
  seed?: string;                         // PRNG seed for reproducibility
  source_questions_hash?: string;        // Hash of source questions for verification
}
```

#### Mode-Specific Fields

**Global Plans** (SIMULTANEOUS_ALL, TURN_BASED_GUILD):
```typescript
{
  question_ids: string[];                // Ordered list of question IDs
  question_count: number;                // Length of question_ids
}
```

**Per-Guild Plans** (RANDOMIZED_PER_GUILD):
```typescript
{
  guild_question_ids: Record<string, string[]>;    // guild_id -> question sequence
  guild_question_count: Record<string, number>;    // guild_id -> count
}
```

## Enums

### ModeType
- **SIMULTANEOUS_ALL**: All students answer same question at same time
- **TURN_BASED_GUILD**: Guilds take turns, all see same global sequence
- **RANDOMIZED_PER_GUILD**: Each guild has its own randomized question sequence

### QuestionSelectionMode
- **ORDERED**: Questions presented in order_key sequence (001, 002, 003, ...)
- **RANDOM_NO_REPEAT**: Questions shuffled deterministically using seeded PRNG

## Plan Generation Logic

### Algorithm

When `createQuestionPlanForInstance()` is called:

1. **Load Battle Instance**
   - Require status: LOBBY or COUNTDOWN
   - Extract: mode_type, question_selection_mode, boss_template_id, class_id

2. **Load Questions**
   - Query BossQuestions by boss_template_id (GSI1)
   - Sort by order_key (zero-padded strings: "0001", "0002", ...)

3. **Generate Seed**
   - Create random UUID for determinism
   - Same seed → same question order (reproducible)

4. **Generate Plan Based on Mode**

#### Global Plans (SIMULTANEOUS_ALL, TURN_BASED_GUILD)

```typescript
if (mode_type === "SIMULTANEOUS_ALL" || mode_type === "TURN_BASED_GUILD") {
  if (question_selection_mode === "ORDERED") {
    // Use sorted order directly
    question_ids = sortedQuestionIds;
  } else {
    // RANDOM_NO_REPEAT: seeded shuffle
    question_ids = seededShuffle(sortedQuestionIds, seed);
  }

  // Write plan
  await putQuestionPlan({
    ...metadata,
    question_ids,
    question_count: question_ids.length,
    seed
  });

  // Update BossBattleInstances
  await updateInstance({
    question_plan_id: planId,
    current_question_index: 0
  });
}
```

#### Per-Guild Plans (RANDOMIZED_PER_GUILD)

```typescript
if (mode_type === "RANDOMIZED_PER_GUILD") {
  // Load participants snapshot
  const snapshot = await getSnapshot(participants_snapshot_id);
  const guildIds = Object.keys(snapshot.guild_counts);

  // Generate sequence for each guild
  for (const guildId of guildIds) {
    if (question_selection_mode === "ORDERED") {
      guildQuestionIds[guildId] = [...sortedQuestionIds];
    } else {
      // RANDOM_NO_REPEAT: derive guild-specific seed
      const guildSeed = deriveGuildSeed(seed, guildId);
      guildQuestionIds[guildId] = seededShuffle(sortedQuestionIds, guildSeed);
    }
    guildQuestionCount[guildId] = guildQuestionIds[guildId].length;
  }

  // Write plan
  await putQuestionPlan({
    ...metadata,
    guild_question_ids: guildQuestionIds,
    guild_question_count: guildQuestionCount,
    seed
  });

  // Update BossBattleInstances
  await updateInstance({
    guild_question_plan_id: planId,
    per_guild_question_index: { guild1: 0, guild2: 0, ... }
  });
}
```

### Mode Combinations

| Mode Type | Selection Mode | Behavior |
|-----------|----------------|----------|
| SIMULTANEOUS_ALL | ORDERED | All students see questions in order_key sequence |
| SIMULTANEOUS_ALL | RANDOM_NO_REPEAT | All students see same shuffled sequence |
| TURN_BASED_GUILD | ORDERED | Guilds take turns, all see order_key sequence |
| TURN_BASED_GUILD | RANDOM_NO_REPEAT | Guilds take turns, all see same shuffled sequence |
| RANDOMIZED_PER_GUILD | ORDERED | Each guild sees order_key sequence (same for all) |
| RANDOMIZED_PER_GUILD | RANDOM_NO_REPEAT | Each guild sees different shuffled sequence |

## Determinism Guarantees

### Seeded Shuffle Implementation

Uses **Mulberry32 PRNG** with **Fisher-Yates shuffle**:

```typescript
function createPRNG(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(array: T[], seed: string): T[] {
  const shuffled = [...array];
  const seedNum = hashString(seed);  // djb2 hash
  const random = createPRNG(seedNum);

  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

### Guild Seed Derivation

For per-guild randomization:

```typescript
export function deriveGuildSeed(baseSeed: string, guildId: string): string {
  return `${baseSeed}:${guildId}`;
}
```

**Properties:**
- Same `baseSeed` + `guildId` → same derived seed (deterministic)
- Different `guildId` → different derived seed (independent)
- All guilds share same `baseSeed` → reproducible from single source

### Reproducibility

✅ **Guaranteed**:
- Same seed → same question order (always)
- Same baseSeed + guildId → same guild sequence (always)
- Plan can be regenerated from seed for auditing

✅ **Independent**:
- Different seeds → different orders (very high probability)
- Different guilds → different orders (when using RANDOM_NO_REPEAT)

## Idempotency

Plans are created with **conditional write**:

```typescript
// In updateInstanceWithPlan()
UpdateExpression: "SET question_plan_id = :plan_id, ...",
ConditionExpression: "attribute_not_exists(question_plan_id)"
```

**Guarantees:**
- Battle instance can have only ONE question plan
- Retry calls will fail with `ConditionalCheckFailedException`
- Prevents race conditions during countdown start

## API Endpoints

### GET /boss-battle-question-plans/{plan_id}

Get question plan by ID (debugging/auditing).

**Authorization:** Teacher only (TODO: implement)

**Request:**
```
GET /boss-battle-question-plans/01HQXYZ...
```

**Response (Global Plan):**
```json
{
  "plan_id": "01HQXYZ...",
  "boss_instance_id": "01HQABC...",
  "class_id": "class123",
  "boss_template_id": "template456",
  "mode_type": "SIMULTANEOUS_ALL",
  "question_selection_mode": "RANDOM_NO_REPEAT",
  "created_by_teacher_id": "teacher789",
  "created_at": "2025-01-15T10:30:00Z",
  "version": 1,
  "question_ids": ["q3", "q1", "q5", "q2", "q4"],
  "question_count": 5,
  "seed": "abc123-uuid"
}
```

**Response (Per-Guild Plan):**
```json
{
  "plan_id": "01HQXYZ...",
  "boss_instance_id": "01HQABC...",
  "class_id": "class123",
  "boss_template_id": "template456",
  "mode_type": "RANDOMIZED_PER_GUILD",
  "question_selection_mode": "RANDOM_NO_REPEAT",
  "created_by_teacher_id": "teacher789",
  "created_at": "2025-01-15T10:30:00Z",
  "version": 1,
  "guild_question_ids": {
    "guild1": ["q2", "q5", "q1", "q3", "q4"],
    "guild2": ["q4", "q1", "q3", "q2", "q5"]
  },
  "guild_question_count": {
    "guild1": 5,
    "guild2": 5
  },
  "seed": "abc123-uuid"
}
```

## Integration Example

### Countdown Start Handler

```typescript
// In bossBattleInstances/start-countdown.ts

export const handler = async (event: APIGatewayProxyEventV2) => {
  const bossInstanceId = event.pathParameters?.boss_instance_id;
  const teacherId = extractTeacherId(event);

  // 1. Validate battle is in LOBBY status
  const instance = await getBattleInstance(bossInstanceId);
  if (instance.status !== "LOBBY") {
    throw new Error("Cannot start countdown: battle not in LOBBY");
  }

  // 2. Create participants snapshot
  const snapshot = await createParticipantsSnapshot({
    boss_instance_id: bossInstanceId,
    created_by_teacher_id: teacherId,
  });

  // 3. Create question plan
  const plan = await createQuestionPlanForInstance({
    boss_instance_id: bossInstanceId,
    created_by_teacher_id: teacherId,
  });

  // 4. Start countdown
  await updateBattleStatus(bossInstanceId, "COUNTDOWN");

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Countdown started",
      participants_snapshot_id: snapshot.snapshot_id,
      question_plan_id: plan.plan_id,
    }),
  };
};
```

### Fetching Next Question

**Global Plans:**
```typescript
// Get current question for SIMULTANEOUS_ALL or TURN_BASED_GUILD
const instance = await getBattleInstance(bossInstanceId);
const plan = await getQuestionPlan(instance.question_plan_id);

if (plan.mode_type === "SIMULTANEOUS_ALL" || plan.mode_type === "TURN_BASED_GUILD") {
  const currentIndex = instance.current_question_index;
  const questionId = plan.question_ids[currentIndex];

  // Load question details
  const question = await getBossQuestion(questionId);
  return question;
}
```

**Per-Guild Plans:**
```typescript
// Get current question for RANDOMIZED_PER_GUILD
const instance = await getBattleInstance(bossInstanceId);
const plan = await getQuestionPlan(instance.guild_question_plan_id);
const studentGuildId = "guild1";  // from request context

if (plan.mode_type === "RANDOMIZED_PER_GUILD") {
  const guildIndex = instance.per_guild_question_index[studentGuildId];
  const questionId = plan.guild_question_ids[studentGuildId][guildIndex];

  // Load question details
  const question = await getBossQuestion(questionId);
  return question;
}
```

## Test Scenarios

### Unit Tests

**Seeded Shuffle** (`seededShuffle.test.ts`):
- ✅ Same seed produces same order (determinism)
- ✅ Different seeds produce different orders
- ✅ Shuffle preserves all elements
- ✅ Empty array handling
- ✅ Single element handling
- ✅ Guild seed derivation consistency
- ✅ Different guilds get different seeds
- ✅ Different guild seeds produce different shuffles
- ✅ Reproducibility across multiple runs

**Validation** (`validation.test.ts`):
- ✅ Mode type enum validation
- ✅ Question selection mode enum validation
- ✅ Question IDs list validation
- ✅ Question count validation
- ✅ Guild question IDs map validation
- ✅ Guild question count validation

### Integration Tests (TODO)

**Plan Generation:**
- [ ] ORDERED plan preserves order_key sequence
- [ ] RANDOM_NO_REPEAT with same seed produces same order
- [ ] RANDOM_NO_REPEAT with different seeds produces different orders
- [ ] RANDOMIZED_PER_GUILD generates different orders per guild
- [ ] RANDOMIZED_PER_GUILD with ORDERED generates same order for all guilds

**Idempotency:**
- [ ] Creating plan twice fails with ConditionalCheckFailedException
- [ ] Retrying after failure returns original plan ID

**Error Cases:**
- [ ] Cannot create plan when status is ACTIVE
- [ ] Cannot create plan when status is ENDED
- [ ] Cannot create plan with no questions
- [ ] Cannot create RANDOMIZED_PER_GUILD without snapshot

## Files

```
bossBattleQuestionPlans/
├── types.ts                 # TypeScript types and enums
├── validation.ts            # Input validation functions
├── validation.test.ts       # Validation unit tests
├── seededShuffle.ts         # Deterministic PRNG implementation
├── seededShuffle.test.ts    # Shuffle determinism tests
├── repo.ts                  # DynamoDB operations + plan generator
├── get-plan.ts              # GET /boss-battle-question-plans/{plan_id}
└── README.md                # This file
```

## Future Enhancements

### Potential Features
- [ ] Question difficulty balancing (ensure fair distribution)
- [ ] Question category rotation (e.g., alternate math/science)
- [ ] Custom question weights for selection
- [ ] Plan versioning for battle replays
- [ ] Audit log for plan regeneration requests
- [ ] Teacher preview of question sequences before countdown

### Performance Optimizations
- [ ] Cache question lists per template
- [ ] Batch load questions from DynamoDB
- [ ] Pre-generate common plan patterns

## References

- **BossBattleInstances**: Parent table tracking battle lifecycle
- **BossQuestions**: Source questions with order_key
- **BossBattleSnapshots**: Participant roster at countdown start
- **BossAnswerAttempts**: Records which question was answered (uses plan)

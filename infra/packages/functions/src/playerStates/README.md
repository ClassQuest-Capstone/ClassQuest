# PlayerStates Module

## Overview

The PlayerStates module manages RPG game state for each student within a class. It uses an improved DynamoDB design with composite keys and a GSI for efficient leaderboard queries without table scans.

## Table Design

### Primary Key (Composite)
- **PK**: `class_id` (string) - Partition key
- **SK**: `student_id` (string) - Sort key

This ensures **one player state per student per class**.

### Attributes

| Attribute | Type | Required | Validation | Description |
|-----------|------|----------|------------|-------------|
| `class_id` | string | ✓ | - | Primary partition key |
| `student_id` | string | ✓ | - | Primary sort key |
| `current_xp` | number | ✓ | >= 0 | Current XP in level |
| `xp_to_next_level` | number | ✓ | >= 0 | XP needed for next level |
| `total_xp_earned` | number | ✓ | >= 0 | Total lifetime XP (for leaderboard) |
| `hearts` | number | ✓ | >= 0, <= max_hearts | Current hearts (health) |
| `max_hearts` | number | ✓ | >= 0 | Maximum hearts |
| `gold` | number | ✓ | >= 0 | Current gold |
| `last_weekend_reset_at` | string | - | ISO 8601 | Last weekend reset timestamp |
| `status` | string | ✓ | ALIVE \| DOWNED \| BANNED | Player status |
| `leaderboard_sort` | string | ✓ | Computed | Sort key for leaderboard GSI |
| `created_at` | string | ✓ | Auto-set | ISO timestamp |
| `updated_at` | string | ✓ | Auto-set | ISO timestamp |

### GSI1 - Leaderboard Index

**Purpose**: Query leaderboard sorted by XP (descending) without table scans

- **PK**: `class_id`
- **SK**: `leaderboard_sort`

#### Leaderboard Sort Key Algorithm

To achieve descending XP order in DynamoDB (which only supports ascending sort):

```typescript
leaderboard_sort = invert(total_xp_earned) + "#" + student_id

where:
  invert(x) = (MAX_XP - x).toString().padStart(10, "0")
  MAX_XP = 1,000,000,000
```

**Example**:
- Student A: 1000 XP → `0999999000#student-a`
- Student B: 500 XP → `0999999500#student-b`
- Student C: 1500 XP → `0999998500#student-c`

Querying GSI1 with `ScanIndexForward: true` (ascending) returns:
1. Student C (1500 XP) - lowest sort key
2. Student A (1000 XP)
3. Student B (500 XP) - highest sort key

## Module Structure

```
playerStates/
├── types.ts              # TypeScript types (PlayerStateItem, PlayerStateStatus)
├── leaderboardSort.ts    # Leaderboard sort key computation
├── validation.ts         # Input validation logic
├── repo.ts              # DynamoDB operations
├── upsert-state.ts      # PUT handler (create/update)
├── get.ts               # GET handler (fetch state)
├── get-leaderboard.ts   # GET handler (leaderboard with pagination)
└── README.md            # This file
```

## API Endpoints

### 1. Upsert Player State

**Endpoint**: `PUT /classes/{class_id}/players/{student_id}/state`

Creates a new player state or updates an existing one. Automatically manages `created_at`, `updated_at`, and `leaderboard_sort`.

**Request Body**:
```json
{
  "current_xp": 150,
  "xp_to_next_level": 200,
  "total_xp_earned": 150,
  "hearts": 3,
  "max_hearts": 3,
  "gold": 50,
  "status": "ALIVE",
  "last_weekend_reset_at": "2026-02-10T00:00:00.000Z"
}
```

**Response (200 OK)**:
```json
{
  "ok": true,
  "class_id": "class-123",
  "student_id": "student-456"
}
```

**Validation Errors (400)**:
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "hearts", "error": "cannot exceed max_hearts" },
    { "field": "gold", "error": "must be >= 0" }
  ]
}
```

### 2. Get Player State

**Endpoint**: `GET /classes/{class_id}/players/{student_id}/state`

Retrieves the player state for a specific student in a class.

**Response (200 OK)**:
```json
{
  "class_id": "class-123",
  "student_id": "student-456",
  "current_xp": 150,
  "xp_to_next_level": 200,
  "total_xp_earned": 150,
  "hearts": 3,
  "max_hearts": 3,
  "gold": 50,
  "status": "ALIVE",
  "leaderboard_sort": "0999999850#student-456",
  "created_at": "2026-02-13T00:00:00.000Z",
  "updated_at": "2026-02-13T01:00:00.000Z"
}
```

**Response (404 Not Found)**:
```json
{
  "error": "Player state not found"
}
```

### 3. Get Leaderboard

**Endpoint**: `GET /classes/{class_id}/leaderboard?limit=10&cursor=<token>`

Retrieves the leaderboard for a class, sorted by XP descending, with cursor-based pagination.

**Query Parameters**:
- `limit` (optional): Number of results (1-100, default: 50)
- `cursor` (optional): Base64-encoded pagination token from previous response

**Response (200 OK)**:
```json
{
  "items": [
    {
      "class_id": "class-123",
      "student_id": "student-top",
      "total_xp_earned": 5000,
      "current_xp": 200,
      "xp_to_next_level": 500,
      "hearts": 5,
      "max_hearts": 5,
      "gold": 1000,
      "status": "ALIVE",
      "leaderboard_sort": "0999995000#student-top",
      "created_at": "2026-02-01T00:00:00.000Z",
      "updated_at": "2026-02-13T01:00:00.000Z"
    }
  ],
  "nextCursor": "eyJjbGFzc19pZCI6ImNsYXNzLTEyMyIsInN0dWRlbnRfaWQiOiJzdHVkZW50LTEwIn0=",
  "hasMore": true
}
```

**Pagination Example**:
```javascript
// First page
const page1 = await getLeaderboard("class-123", 10);

// Next page
if (page1.hasMore) {
  const page2 = await getLeaderboard("class-123", 10, page1.nextCursor);
}
```

## Repository Functions

### Core Operations

#### `upsertPlayerState(item)`
Creates or updates a player state. Automatically:
- Computes `leaderboard_sort` from `total_xp_earned`
- Sets `created_at` on first insert (preserves on updates)
- Updates `updated_at` to current timestamp

```typescript
await upsertPlayerState({
  class_id: "class-123",
  student_id: "student-456",
  current_xp: 150,
  xp_to_next_level: 200,
  total_xp_earned: 150,
  hearts: 3,
  max_hearts: 3,
  gold: 50,
  status: "ALIVE"
});
```

#### `getPlayerState(class_id, student_id)`
Retrieves a player state by primary key.

```typescript
const state = await getPlayerState("class-123", "student-456");
```

#### `listLeaderboard(class_id, limit?, cursor?)`
Queries GSI1 for leaderboard with pagination.

```typescript
const { items, nextCursor } = await listLeaderboard("class-123", 50, cursor);
```

### Utility Functions

#### `makeLeaderboardSort(total_xp_earned, student_id)` (from `leaderboardSort.ts`)
Computes the inverted sort key for descending XP order.

```typescript
const sortKey = makeLeaderboardSort(1500, "student-c");
// Returns: "0999998500#student-c"
```

#### `validatePlayerState(data)` (from `validation.ts`)
Validates player state input and returns array of errors.

```typescript
const errors = validatePlayerState(body);
if (errors.length > 0) {
  // Handle validation errors
}
```

## Frontend API Client

Located at: `app/frontend/src/api/playerStates.ts`

### Usage Examples

```typescript
import {
  upsertPlayerState,
  getPlayerState,
  getLeaderboard
} from '@/api/playerStates';

// Create or update player state
await upsertPlayerState('class-123', 'student-456', {
  current_xp: 150,
  xp_to_next_level: 200,
  total_xp_earned: 150,
  hearts: 3,
  max_hearts: 3,
  gold: 50,
  status: 'ALIVE'
});

// Get player state
const state = await getPlayerState('class-123', 'student-456');

// Get top 10 players
const { items, nextCursor, hasMore } = await getLeaderboard('class-123', 10);

// Paginate through leaderboard
if (hasMore) {
  const nextPage = await getLeaderboard('class-123', 10, nextCursor);
}
```

## Validation Rules

All validation is performed in `validation.ts`:

1. **Required Fields**: All fields except `last_weekend_reset_at` are required
2. **Numeric Fields**: Must be numbers and >= 0
   - `current_xp`, `xp_to_next_level`, `total_xp_earned`, `hearts`, `max_hearts`, `gold`
3. **Hearts Constraint**: `hearts <= max_hearts`
4. **Status Enum**: Must be one of `"ALIVE"`, `"DOWNED"`, `"BANNED"`
5. **ISO Timestamp**: `last_weekend_reset_at` must be valid ISO 8601 string (if provided)

## Error Responses

All endpoints return consistent error format:

**400 Bad Request**:
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "hearts", "error": "cannot exceed max_hearts" }
  ]
}
```

**404 Not Found**:
```json
{
  "error": "Player state not found"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Internal server error",
  "message": "DynamoDB connection failed"
}
```

## Environment Variables

The table name is automatically injected by SST:
- `PLAYER_STATES_TABLE_NAME` - Available to all Lambda functions

## Permissions

All API functions have read/write permissions to the PlayerStates table via `api.attachPermissions()` in `infra/stacks/api.ts`.

## Performance Characteristics

- **Get by PK**: Single-digit millisecond latency (GetCommand)
- **Leaderboard Query**: Sub-10ms for 50 items (GSI1 query, no scans)
- **Pagination**: Efficient cursor-based (no offset scans)
- **Max XP**: 1 billion (adjustable via MAX_XP constant)

## Design Decisions

### Why Composite Keys?
- Natural one-to-one relationship (one state per student per class)
- Efficient queries: "get all players in class X"
- Strong consistency within a class

### Why Inverted Sort Key?
- DynamoDB only supports ascending sort on GSI sort keys
- Inverted values enable descending order: higher XP → lower sort value
- Querying with `ScanIndexForward: true` yields descending XP results

### Why Include student_id in Sort Key?
- Ensures unique sort keys even if students have identical XP
- Prevents GSI key conflicts
- Provides stable ordering for tied scores

### Why Cursor-Based Pagination?
- Efficient: no offset calculations, direct key-based resumption
- Consistent: immune to data changes between pages
- Scalable: constant time per page regardless of position

## Future Enhancements

- Batch upsert endpoint for class-wide operations (e.g., weekend resets)
- Optimistic locking with version numbers to prevent race conditions
- Filtered leaderboard queries (e.g., top players by status)
- Atomic increment operations for XP/gold updates
- Leaderboard caching with TTL for frequently accessed classes

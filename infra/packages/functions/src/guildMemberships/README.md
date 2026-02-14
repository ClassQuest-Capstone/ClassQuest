# GuildMemberships Module (Option A)

## Overview

The GuildMemberships module manages student membership in guilds. Using **Option A** design, the primary key is `(class_id, student_id)`, which enforces **one guild per student per class** at the database level.

## Table Design

### Primary Key (Composite)
- **PK**: `class_id` (string)
- **SK**: `student_id` (string)

This composite key ensures **uniqueness constraint**: a student can belong to at most one guild per class.

### Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `class_id` | string | ✓ | Primary partition key |
| `student_id` | string | ✓ | Primary sort key |
| `guild_id` | string | ✓ | Guild this student belongs to |
| `role_in_guild` | string | ✓ | `"LEADER"` or `"MEMBER"` |
| `joined_at` | string | ✓ | ISO 8601 timestamp when joined |
| `left_at` | string | - | ISO 8601 timestamp when left (null if active) |
| `is_active` | boolean | ✓ | `true` if currently in guild, `false` if left |
| `updated_at` | string | ✓ | ISO 8601 timestamp |
| `gsi1sk` | string | ✓ | Computed: `joined_at#student_id` |
| `gsi2sk` | string | ✓ | Computed: `joined_at#class_id#guild_id` |

### GSI1 - Guild Roster

**Purpose**: Query all members in a guild, ordered by join date

- **Index Name**: `gsi1`
- **PK**: `guild_id`
- **SK**: `gsi1sk` (format: `joined_at#student_id`)

Enables efficient queries like "list all members of guild X" with chronological ordering.

### GSI2 - Student Membership History

**Purpose**: Query all guilds a student has joined across classes

- **Index Name**: `gsi2`
- **PK**: `student_id`
- **SK**: `gsi2sk` (format: `joined_at#class_id#guild_id`)

Enables queries like "list all guilds student X has been in" across different classes and time periods.

## Module Structure

```
guildMemberships/
├── types.ts              # TypeScript types (RoleInGuild, GuildMembershipItem)
├── keys.ts               # makeGsi1Sk, makeGsi2Sk
├── validation.ts         # Input validation
├── repo.ts              # DynamoDB operations
├── upsert-membership.ts # PUT handler (create/update/change)
├── get.ts               # GET handler
├── list-by-guild.ts     # GET handler (roster)
├── list-by-student.ts   # GET handler (history)
├── leave.ts             # PATCH handler
└── README.md            # This file
```

## API Endpoints

### 1. Upsert Membership

**Endpoint**: `PUT /classes/{class_id}/guild-memberships/{student_id}`

Creates a new membership, updates role, or changes guild.

**Behavior**:
- **If no record exists**: Creates new membership
- **If record exists with same guild_id**: Updates role if provided
- **If record exists with different guild_id**: Changes guild (resets joined_at, removes left_at)

**Request Body**:
```json
{
  "guild_id": "550e8400-e29b-41d4-a716-446655440000",
  "role_in_guild": "LEADER"
}
```

**Notes**:
- `role_in_guild` defaults to `"MEMBER"` if not provided
- `joined_at` is set/reset when joining or changing guilds
- `is_active` is always set to `true` on join/change
- `left_at` is removed on join/change

**Response (201 Created)** - New membership:
```json
{
  "class_id": "class-123",
  "student_id": "student-456",
  "guild_id": "550e8400-e29b-41d4-a716-446655440000",
  "role_in_guild": "LEADER",
  "joined_at": "2026-02-13T00:00:00.000Z",
  "is_active": true,
  "updated_at": "2026-02-13T00:00:00.000Z",
  "gsi1sk": "2026-02-13T00:00:00.000Z#student-456",
  "gsi2sk": "2026-02-13T00:00:00.000Z#class-123#550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200 OK)** - Updated/changed membership:
Returns the updated membership object.

**Validation Errors (400)**:
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "guild_id", "error": "required" },
    { "field": "role_in_guild", "error": "must be one of: LEADER, MEMBER" }
  ]
}
```

### 2. Get Membership

**Endpoint**: `GET /classes/{class_id}/guild-memberships/{student_id}`

Retrieves the membership record for a student in a class.

**Response (200 OK)**:
```json
{
  "class_id": "class-123",
  "student_id": "student-456",
  "guild_id": "550e8400-e29b-41d4-a716-446655440000",
  "role_in_guild": "MEMBER",
  "joined_at": "2026-02-13T00:00:00.000Z",
  "is_active": true,
  "updated_at": "2026-02-13T00:00:00.000Z",
  "gsi1sk": "2026-02-13T00:00:00.000Z#student-456",
  "gsi2sk": "2026-02-13T00:00:00.000Z#class-123#550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (404 Not Found)**:
```json
{
  "error": "Membership not found"
}
```

### 3. List Guild Members (Roster)

**Endpoint**: `GET /guilds/{guild_id}/members?limit=20&cursor=<token>`

Lists all members in a guild with cursor-based pagination.

**Query Parameters**:
- `limit` (optional): Number of results (1-100, default: 50)
- `cursor` (optional): Base64-encoded pagination token

**Response (200 OK)**:
```json
{
  "items": [
    {
      "class_id": "class-123",
      "student_id": "student-456",
      "guild_id": "550e8400-e29b-41d4-a716-446655440000",
      "role_in_guild": "LEADER",
      "joined_at": "2026-02-13T00:00:00.000Z",
      "is_active": true,
      "updated_at": "2026-02-13T00:00:00.000Z",
      "gsi1sk": "2026-02-13T00:00:00.000Z#student-456",
      "gsi2sk": "2026-02-13T00:00:00.000Z#class-123#550e8400-e29b-41d4-a716-446655440000"
    }
  ],
  "nextCursor": "eyJndWlsZF9pZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCJ9",
  "hasMore": true
}
```

### 4. List Student Memberships (History)

**Endpoint**: `GET /students/{student_id}/guild-memberships?limit=20&cursor=<token>`

Lists all guilds a student has been in across all classes (membership history).

**Query Parameters**:
- `limit` (optional): Number of results (1-100, default: 50)
- `cursor` (optional): Base64-encoded pagination token

**Response (200 OK)**:
Returns list of memberships across different classes, ordered by joined_at.

### 5. Leave Guild

**Endpoint**: `PATCH /classes/{class_id}/guild-memberships/{student_id}/leave`

Sets `is_active=false`, records `left_at` timestamp.

**Response (200 OK)**:
```json
{
  "class_id": "class-123",
  "student_id": "student-456",
  "guild_id": "550e8400-e29b-41d4-a716-446655440000",
  "role_in_guild": "MEMBER",
  "joined_at": "2026-02-13T00:00:00.000Z",
  "left_at": "2026-02-14T00:00:00.000Z",
  "is_active": false,
  "updated_at": "2026-02-14T00:00:00.000Z",
  "gsi1sk": "2026-02-13T00:00:00.000Z#student-456",
  "gsi2sk": "2026-02-13T00:00:00.000Z#class-123#550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (404 Not Found)**:
```json
{
  "error": "Membership not found"
}
```

## Repository Functions

### `upsertMembership(item: GuildMembershipItem)`
Idempotent upsert by PK/SK (class_id, student_id).

```typescript
await upsertMembership({
  class_id: "class-123",
  student_id: "student-456",
  guild_id: "guild-789",
  role_in_guild: "MEMBER",
  joined_at: now,
  is_active: true,
  updated_at: now,
  gsi1sk: makeGsi1Sk(now, "student-456"),
  gsi2sk: makeGsi2Sk(now, "class-123", "guild-789")
});
```

### `getMembership(class_id: string, student_id: string)`
Retrieves membership by primary key.

```typescript
const membership = await getMembership("class-123", "student-456");
```

### `listMembersByGuild(guild_id: string, limit?: number, cursor?: string)`
Queries GSI1 for guild roster with pagination.

```typescript
const { items, nextCursor } = await listMembersByGuild("guild-789", 50, cursor);
```

### `listStudentMemberships(student_id: string, limit?: number, cursor?: string)`
Queries GSI2 for student's membership history across classes.

```typescript
const { items, nextCursor } = await listStudentMemberships("student-456", 50, cursor);
```

### `leaveGuild(class_id: string, student_id: string)`
Sets `is_active=false`, records `left_at`.

```typescript
const updated = await leaveGuild("class-123", "student-456");
```

### `changeGuild(class_id: string, student_id: string, newGuildId: string, role: string)`
Changes guild membership:
- Updates `guild_id`
- Resets `joined_at` to current time
- Removes `left_at`
- Sets `is_active=true`
- Recomputes GSI keys

```typescript
const updated = await changeGuild("class-123", "student-456", "new-guild-id", "MEMBER");
```

## Utility Functions

### `makeGsi1Sk(joined_at: string, student_id: string)` (from `keys.ts`)
Creates GSI1 sort key for guild roster ordering.

```typescript
const gsi1sk = makeGsi1Sk("2026-02-13T00:00:00.000Z", "student-456");
// Returns: "2026-02-13T00:00:00.000Z#student-456"
```

### `makeGsi2Sk(joined_at: string, class_id: string, guild_id: string)` (from `keys.ts`)
Creates GSI2 sort key for student membership history.

```typescript
const gsi2sk = makeGsi2Sk("2026-02-13T00:00:00.000Z", "class-123", "guild-789");
// Returns: "2026-02-13T00:00:00.000Z#class-123#guild-789"
```

## Validation Rules

1. **guild_id**: Required, non-empty string
2. **role_in_guild**: Optional, defaults to `"MEMBER"`, must be `"LEADER"` or `"MEMBER"`
3. **class_id, student_id**: Required in path parameters
4. **Timestamps**: Generated server-side (ISO 8601)

## Error Responses

**400 Bad Request**:
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "guild_id", "error": "required" }
  ]
}
```

**404 Not Found**:
```json
{
  "error": "Membership not found"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Internal server error",
  "message": "DynamoDB connection failed"
}
```

## Frontend API Client

Located at: `app/frontend/src/api/guildMemberships.ts`

### Core Functions

```typescript
import {
  upsertGuildMembership,
  getGuildMembership,
  listGuildMembers,
  listStudentMemberships,
  leaveGuild
} from '@/api/guildMemberships';

// Join a guild
await upsertGuildMembership('class-123', 'student-456', {
  guild_id: 'guild-789',
  role_in_guild: 'MEMBER'
});

// Get student's current membership in a class
const membership = await getGuildMembership('class-123', 'student-456');

// Get guild roster
const { items, nextCursor, hasMore } = await listGuildMembers('guild-789', 20);

// Paginate through members
if (hasMore) {
  const nextPage = await listGuildMembers('guild-789', 20, nextCursor);
}

// Get student's membership history
const { items: history } = await listStudentMemberships('student-456');

// Leave guild
await leaveGuild('class-123', 'student-456');
```

### Convenience Functions

The API client includes helpful wrapper functions:

```typescript
import {
  joinGuild,
  changeGuild,
  promoteToLeader,
  demoteToMember
} from '@/api/guildMemberships';

// Join a guild (wrapper around upsert)
await joinGuild('class-123', 'student-456', 'guild-789', 'MEMBER');

// Change to different guild
await changeGuild('class-123', 'student-456', 'new-guild-id', 'MEMBER');

// Promote to leader
await promoteToLeader('class-123', 'student-456', 'guild-789');

// Demote to member
await demoteToMember('class-123', 'student-456', 'guild-789');
```

## Environment Variables

- `GUILD_MEMBERSHIPS_TABLE_NAME` - Automatically injected by SST

## Permissions

All API functions have read/write permissions via `api.attachPermissions()`.

## Performance Characteristics

- **Get by PK/SK**: Single-digit millisecond latency
- **List by Guild (GSI1)**: <10ms for 50 items (no scans)
- **List by Student (GSI2)**: <10ms for 50 items (no scans)
- **Upsert**: Idempotent write (~5-10ms)
- **Pagination**: Efficient cursor-based (constant time per page)

## Design Decisions

### Why (class_id, student_id) as Primary Key?

**Enforces uniqueness constraint at database level**: A student can only belong to one guild per class. Attempting to join a second guild requires explicitly changing guilds (overwrites the existing record).

**Advantages**:
- No need for application-level checks
- Atomic operations (no race conditions)
- Simple, predictable behavior

**Tradeoffs**:
- Cannot query "all memberships by guild_id" without GSI
- Must use GSI1 for roster queries

### Why GSI1 with joined_at#student_id?

Enables chronological ordering of guild members:
- Shows who joined first (useful for leadership, seniority)
- `student_id` suffix ensures uniqueness (handles simultaneous joins)

### Why GSI2 with joined_at#class_id#guild_id?

Enables student membership history queries:
- Shows timeline of guild changes
- Tracks multi-class participation
- Useful for analytics and student profiles

### Why is_active Flag?

Soft deletion pattern:
- Preserves membership history (when student left, which guild)
- Enables analytics (retention, churn rate)
- Allows "rejoin guild" without losing historical data

### Why Separate joined_at and left_at?

Tracks membership duration:
- `joined_at`: When student joined (never changes after creation unless changing guilds)
- `left_at`: When student left (null if active)
- Enables analytics: average membership duration, most stable guilds

## Common Operations

### Join a Guild
```
PUT /classes/{class_id}/guild-memberships/{student_id}
Body: { guild_id: "...", role_in_guild: "MEMBER" }
```

### Change Guild (Switch)
```
PUT /classes/{class_id}/guild-memberships/{student_id}
Body: { guild_id: "new-guild-id", role_in_guild: "MEMBER" }
```
(If student is already in a guild, this overwrites with new guild)

### Promote to Leader
```
PUT /classes/{class_id}/guild-memberships/{student_id}
Body: { guild_id: "same-guild-id", role_in_guild: "LEADER" }
```

### Leave Guild
```
PATCH /classes/{class_id}/guild-memberships/{student_id}/leave
```

### Check Student's Current Guild in Class
```
GET /classes/{class_id}/guild-memberships/{student_id}
```

### Get Guild Roster
```
GET /guilds/{guild_id}/members
```

### Get Student's Guild History
```
GET /students/{student_id}/guild-memberships
```

## Future Enhancements

- Batch operations for class-wide guild assignments
- Transfer leadership endpoint (swap roles between two students)
- Filtered roster queries (e.g., only active members, only leaders)
- Guild membership limits (max members per guild)
- Invite system (pending invitations)
- Membership duration analytics endpoint

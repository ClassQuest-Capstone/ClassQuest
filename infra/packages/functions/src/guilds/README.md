# Guilds Module

## Overview

The Guilds module manages student teams (guilds) within a class. Each guild belongs to a single class and can have multiple students as members (managed via GuildMemberships table, not implemented here).

## Table Design

### Primary Key
- **PK**: `guild_id` (string UUID) - Unique guild identifier

### Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `guild_id` | string | ✓ | Primary key (UUID) |
| `class_id` | string | ✓ | Class this guild belongs to |
| `name` | string | ✓ | Guild name (trimmed, non-empty) |
| `is_active` | boolean | ✓ | Whether guild is active |
| `gsi1sk` | string | ✓ | Computed: `created_at#guild_id` (for stable ordering) |
| `created_at` | string | ✓ | ISO 8601 timestamp |
| `updated_at` | string | ✓ | ISO 8601 timestamp |

### GSI1 - List Guilds by Class

**Purpose**: Query all guilds in a class, ordered by creation time

- **Index Name**: `gsi1`
- **PK**: `class_id`
- **SK**: `gsi1sk` (format: `created_at#guild_id`)

This enables efficient queries like "list all guilds in class X" with chronological ordering.

## Module Structure

```
guilds/
├── types.ts          # TypeScript types (GuildItem)
├── keys.ts           # makeGsi1Sk(created_at, guild_id)
├── validation.ts     # Input validation
├── repo.ts          # DynamoDB operations
├── create.ts        # POST handler
├── get.ts           # GET handler
├── list-by-class.ts # GET handler with pagination
├── update.ts        # PATCH handler
├── deactivate.ts    # PATCH handler
└── README.md        # This file
```

## API Endpoints

### 1. Create Guild

**Endpoint**: `POST /classes/{class_id}/guilds`

Creates a new guild in a class. Generates UUID, sets `is_active=true`, and computes `gsi1sk`.

**Request Body**:
```json
{
  "name": "Dragon Slayers"
}
```

**Response (201 Created)**:
```json
{
  "ok": true,
  "guild_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation Errors (400)**:
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "name", "error": "required" }
  ]
}
```

### 2. Get Guild

**Endpoint**: `GET /guilds/{guild_id}`

Retrieves a guild by ID.

**Response (200 OK)**:
```json
{
  "guild_id": "550e8400-e29b-41d4-a716-446655440000",
  "class_id": "class-123",
  "name": "Dragon Slayers",
  "is_active": true,
  "gsi1sk": "2026-02-13T00:00:00.000Z#550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-02-13T00:00:00.000Z",
  "updated_at": "2026-02-13T00:00:00.000Z"
}
```

**Response (404 Not Found)**:
```json
{
  "error": "Guild not found"
}
```

### 3. List Guilds by Class

**Endpoint**: `GET /classes/{class_id}/guilds?limit=10&cursor=<token>`

Lists all guilds in a class with cursor-based pagination.

**Query Parameters**:
- `limit` (optional): Number of results (1-100, default: 50)
- `cursor` (optional): Base64-encoded pagination token

**Response (200 OK)**:
```json
{
  "items": [
    {
      "guild_id": "550e8400-e29b-41d4-a716-446655440000",
      "class_id": "class-123",
      "name": "Dragon Slayers",
      "is_active": true,
      "gsi1sk": "2026-02-13T00:00:00.000Z#550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2026-02-13T00:00:00.000Z",
      "updated_at": "2026-02-13T00:00:00.000Z"
    }
  ],
  "nextCursor": "eyJjbGFzc19pZCI6ImNsYXNzLTEyMyIsImdpbGRfaWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAifQ==",
  "hasMore": true
}
```

### 4. Update Guild

**Endpoint**: `PATCH /guilds/{guild_id}`

Updates guild name and/or active status. Automatically updates `updated_at`.

**Request Body**:
```json
{
  "name": "Phoenix Riders",
  "is_active": false
}
```

**Response (200 OK)**:
Returns the updated guild object.

**Response (404 Not Found)**:
```json
{
  "error": "Guild not found"
}
```

### 5. Deactivate Guild

**Endpoint**: `PATCH /guilds/{guild_id}/deactivate`

Sets `is_active=false` and updates timestamp.

**Response (200 OK)**:
Returns the updated guild object.

## Repository Functions

### `createGuild(item: GuildItem)`
Creates a new guild with condition check to prevent overwrites.

```typescript
await createGuild({
  guild_id: "550e8400-e29b-41d4-a716-446655440000",
  class_id: "class-123",
  name: "Dragon Slayers",
  is_active: true,
  gsi1sk: makeGsi1Sk(now, guild_id),
  created_at: now,
  updated_at: now
});
```

### `getGuild(guild_id: string)`
Retrieves guild by primary key.

```typescript
const guild = await getGuild("550e8400-e29b-41d4-a716-446655440000");
```

### `listGuildsByClass(class_id: string, limit?: number, cursor?: string)`
Queries GSI1 for all guilds in a class with pagination.

```typescript
const { items, nextCursor } = await listGuildsByClass("class-123", 50, cursor);
```

### `updateGuild(guild_id: string, patch: { name?: string; is_active?: boolean })`
Updates guild fields dynamically and sets `updated_at`.

```typescript
const updated = await updateGuild(guild_id, {
  name: "Phoenix Riders",
  is_active: false
});
```

### `deactivateGuild(guild_id: string)`
Sets `is_active=false` and updates timestamp.

```typescript
const deactivated = await deactivateGuild(guild_id);
```

## Utility Functions

### `makeGsi1Sk(created_at: string, guild_id: string)` (from `keys.ts`)
Creates composite sort key for GSI1.

```typescript
const gsi1sk = makeGsi1Sk("2026-02-13T00:00:00.000Z", guild_id);
// Returns: "2026-02-13T00:00:00.000Z#550e8400-e29b-41d4-a716-446655440000"
```

### `validateGuildName(name: any)` (from `validation.ts`)
Validates guild name is non-empty string.

```typescript
const errors = validateGuildName(name);
if (errors.length > 0) {
  // Handle validation errors
}
```

### `validateGuildPatch(patch: any)` (from `validation.ts`)
Validates update patch fields.

```typescript
const errors = validateGuildPatch(body);
```

## Frontend API Client

Located at: `app/frontend/src/api/guilds.ts`

### Usage Examples

```typescript
import {
  createGuild,
  getGuild,
  listGuildsByClass,
  updateGuild,
  deactivateGuild
} from '@/api/guilds';

// Create guild
const { guild_id } = await createGuild('class-123', {
  name: 'Dragon Slayers'
});

// Get guild
const guild = await getGuild(guild_id);

// List guilds in class
const { items, nextCursor, hasMore } = await listGuildsByClass('class-123', 20);

// Paginate
if (hasMore) {
  const nextPage = await listGuildsByClass('class-123', 20, nextCursor);
}

// Update guild
await updateGuild(guild_id, {
  name: 'Phoenix Riders'
});

// Deactivate guild
await deactivateGuild(guild_id);
```

## Validation Rules

1. **Name**: Required, non-empty string after trimming
2. **class_id**: Required in path parameter
3. **is_active**: Must be boolean if provided

## Error Responses

**400 Bad Request**:
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "name", "error": "cannot be empty" }
  ]
}
```

**404 Not Found**:
```json
{
  "error": "Guild not found"
}
```

**409 Conflict** (rare - duplicate UUID):
```json
{
  "error": "Guild already exists"
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

- `GUILDS_TABLE_NAME` - Automatically injected by SST

## Permissions

All API functions have read/write permissions via `api.attachPermissions()`.

## Performance Characteristics

- **Create**: Single write with condition check (~5-10ms)
- **Get by PK**: Single-digit millisecond latency
- **List by Class**: GSI1 query, no scans (<10ms for 50 items)
- **Update**: Atomic UpdateCommand (~5-10ms)
- **Pagination**: Efficient cursor-based (constant time per page)

## Design Decisions

### Why UUID for guild_id?
- Globally unique without coordination
- Can generate client-side if needed
- No collision risk across classes

### Why GSI1 with Composite Sort Key?
- Enables "list guilds by class" without scans
- Chronological ordering via `created_at` prefix
- `guild_id` suffix ensures uniqueness

### Why Separate is_active Flag?
- Soft deletion pattern (preserves data for auditing)
- Allows reactivation without recreation
- Simplifies member management (members remain linked)

### Why Trim Name on Create/Update?
- Prevents accidental whitespace-only names
- Consistent UX (no leading/trailing spaces)
- Validation happens server-side

## Related Tables (Not Implemented Here)

- **GuildMemberships**: Links students to guilds (many-to-many)
- **BossBattles**: Guild participation in boss battles

These tables are intentionally excluded from this implementation as per requirements.

## Future Enhancements

- Batch create guilds endpoint
- Search guilds by name (requires new GSI or scan with filter)
- Guild stats aggregation (member count, total XP, etc.)
- Guild deletion (hard delete vs. soft delete with is_active)
- Guild capacity limits (max members per guild)

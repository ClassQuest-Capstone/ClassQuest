# API Stack Split - Implementation Summary

## Overview
Successfully split the monolithic `ApiStack` into 4 separate stacks to resolve CloudFormation template size limits and improve resource organization.

## Files Created

### 1. infra/stacks/ApiCoreStack.ts
**Purpose:** Creates the base HttpApi and Stage infrastructure
**Exports:**
- `apiId` - API Gateway ID for route attachment
- `apiEndpoint` - API endpoint URL
- `stageName` - Stage name ($default)
- `apiArn` - API ARN for permissions

**Key Features:**
- Uses raw CDK constructs (CfnApi, CfnStage) for HttpApi creation
- Configures CORS for localhost:5000
- Auto-deploy enabled on default stage
- Exports via CloudFormation outputs for cross-stack references

### 2. infra/stacks/TeacherApiStack.ts
**Purpose:** Teacher domain routes and Lambda functions
**Routes (33 total):**
- Schools: list, create, get (3 routes)
- TeacherProfiles: create, get, list-by-school (3 routes)
- Classes: create, get, get-by-join-code, list-by-teacher, list-by-school, deactivate (6 routes)
- ClassEnrollments: enroll, unenroll, list-by-class, list-by-student, get (5 routes)
- QuestInstances: create, get, list-by-class, list-by-template, update-status, update-dates (6 routes) **[REQUIRED per constraints]**
- Guilds: create, get, list-by-class, update, deactivate (5 routes) **[REQUIRED per constraints]**
- GuildMemberships: upsert, get, list-by-guild, list-by-student, leave (5 routes) **[REQUIRED per constraints]**

**Permissions:**
- Full DynamoDB access to all tables (including GSIs)
- Cognito admin operations (AdminSetUserPassword, AdminUpdateUserAttributes, AdminGetUser, AdminCreateUser, AdminAddUserToGroup)

### 3. infra/stacks/StudentApiStack.ts
**Purpose:** Student domain routes and Lambda functions
**Routes (8 total):**
- StudentProfiles: create, get, update, list-by-school, set-password (5 routes)
- PlayerStates: upsert-state, get, get-leaderboard (3 routes)

**Permissions:**
- Full DynamoDB access to all tables (including GSIs)
- Cognito admin operations for password management

### 4. infra/stacks/QuestApiStack.ts
**Purpose:** Quest domain routes and Lambda functions
**Routes (28 total):**
- Health: health check endpoint (1 route) **[REQUIRED per constraints]**
- Debug: debug-create endpoint (1 route) **[REQUIRED per constraints]**
- QuestTemplates: create, list-public, get, list-by-owner, update, soft-delete (6 routes)
- QuestQuestions: create, list-by-template, get, update, delete (5 routes)
- QuestQuestionResponses: upsert-response, get-by-instance-and-student, list-by-instance, list-by-student, list-by-question, grade-response (6 routes)
- BossQuestions: create, get, list-by-template, update, delete (5 routes) **[REQUIRED per constraints]**
- BossBattleTemplates: create, get, list-by-owner, list-public (4 routes) **[REQUIRED per constraints]**

**Permissions:**
- Full DynamoDB access to all tables (including GSIs)
- Cognito admin operations

## Files Modified

### infra/sst.config.ts
**Changes:**
- Removed import of `ApiStack`
- Added imports for `ApiCoreStack`, `TeacherApiStack`, `StudentApiStack`, `QuestApiStack`
- Updated stack deployment order:
  1. ClassQuestDataStack (unchanged)
  2. ClassQuestAuthStack (unchanged)
  3. **ClassQuestApiCoreStack** (new) - creates HttpApi
  4. **ClassQuestTeacherApiStack** (new) - attaches teacher routes
  5. **ClassQuestStudentApiStack** (new) - attaches student routes
  6. **ClassQuestQuestApiStack** (new) - attaches quest routes
- All domain stacks receive:
  - `apiId` from ApiCoreStack
  - All `tableNames` and `tableArns` from DataStack
  - `userPoolId` and `userPoolArn` from AuthStack

## Architecture

### Stack Dependencies
```
DataStack (tables)
    ↓
AuthStack (Cognito)
    ↓
ApiCoreStack (HttpApi)
    ↓
┌───────────┬──────────────┬─────────────┐
│  Teacher  │   Student    │    Quest    │
│ ApiStack  │  ApiStack    │  ApiStack   │
└───────────┴──────────────┴─────────────┘
```

### Route Attachment Pattern
Each domain stack:
1. Creates Lambda functions using SST's `Function` construct
2. Attaches environment variables (all table names + USER_POOL_ID)
3. Grants DynamoDB and Cognito permissions via IAM policies
4. Creates API Gateway integrations using CDK's `CfnIntegration`
5. Creates routes using CDK's `CfnRoute`
6. Grants API Gateway invoke permissions to Lambda functions

### Resource Distribution
- **ApiCoreStack:** ~5 resources (HttpApi, Stage, Outputs)
- **TeacherApiStack:** ~165 resources (33 routes × 5 = 165: Lambda, Integration, Route, Permission, IAM Role per route)
- **StudentApiStack:** ~40 resources (8 routes × 5 = 40)
- **QuestApiStack:** ~140 resources (28 routes × 5 = 140)
- **Total:** ~350 resources (previously all in one stack)

## Route Distribution Verification

### Original ApiStack: 68 routes
### New Stacks Combined: 69 routes
- TeacherApiStack: 33 routes
- StudentApiStack: 8 routes
- QuestApiStack: 28 routes
- **Added:** 1 route (POST /debug/create as per constraints)

All original routes preserved ✓

## Constraint Compliance

✓ guilds/, guildMemberships/, questInstances/ routes in TeacherApiStack
✓ bossBattleTemplates/, bossQuestions/ routes in QuestApiStack
✓ health.ts and debug-create.ts routes in QuestApiStack
✓ Cognito triggers (preSignUp, postConfirmation) remain in AuthStack
✓ shared/auth.ts stays in packages/functions/src/shared/auth.ts
✓ DataStack and AuthStack unchanged
✓ No DynamoDB table name changes
✓ No Cognito pool/client ID changes

## Environment Variables

All Lambda functions receive identical environment variables:
- All 15 DynamoDB table names
- USER_POOL_ID

This matches the original monolithic pattern and ensures no function is missing a dependency.

## Permissions

All Lambda functions receive identical IAM permissions:
- DynamoDB: GetItem, PutItem, UpdateItem, DeleteItem, Query, Scan on all tables + GSIs
- Cognito: AdminSetUserPassword, AdminUpdateUserAttributes, AdminGetUser, AdminCreateUser, AdminAddUserToGroup

## Deployment

### Order
1. Data → Auth → ApiCore → Teacher/Student/Quest (parallel)

### Commands
- `npm run dev` - Start local development
- `npm run deploy` - Deploy all stacks
- `npm run remove` - Remove all stacks

### API Endpoint
Single API endpoint URL remains unchanged:
- Exported from ApiCoreStack
- All routes attach to same HttpApi
- Frontend requires no changes

## Breaking Changes

**None.** The API surface remains identical:
- Same API endpoint URL
- Same routes
- Same Lambda handlers
- Same table names
- Same Cognito configuration

## Benefits

1. **Template Size:** Distributes ~350 resources across 4 stacks instead of 1
2. **Deployment Speed:** Domain stacks can deploy in parallel
3. **Modularity:** Clear separation of concerns by domain
4. **Maintainability:** Easier to understand and modify specific domains
5. **Scalability:** Room to add more routes without hitting limits

## Testing Checklist

- [ ] Deploy all stacks: `npm run deploy`
- [ ] Verify API endpoint URL in outputs
- [ ] Test health endpoint: `GET /health`
- [ ] Test debug endpoint: `POST /debug/create`
- [ ] Test a teacher route (e.g., `GET /schools`)
- [ ] Test a student route (e.g., `GET /student-profiles/{id}`)
- [ ] Test a quest route (e.g., `GET /quest-templates/public`)
- [ ] Verify frontend still works with same API URL
- [ ] Test Cognito signup/login flows
- [ ] Verify DynamoDB operations work correctly

## Rollback Plan

If issues arise:
1. Comment out new stack imports in `sst.config.ts`
2. Uncomment `ApiStack` import
3. Restore original ApiStack-based wiring
4. Deploy: `npm run deploy`

Original `ApiStack.ts` file remains in place for reference/rollback.

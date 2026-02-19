# Infrastructure Stack Split

## Problem
The monolithic `ClassQuestStack` exceeded AWS CloudFormation's 500 resource limit (had 532 resources).

## Solution
Split into 3 separate stacks to stay under the limit:

### 1. DataStack (`stacks/DataStack.ts`)
**Resources:** ~60 resources
- All 15 DynamoDB tables with their GSIs
- Exports table names and ARNs for cross-stack references

**Tables:**
- Users
- TeacherProfiles
- StudentProfiles
- Schools
- Classes
- ClassEnrollments
- QuestTemplates
- QuestQuestions
- QuestInstances
- QuestQuestionResponses
- PlayerStates
- Guilds
- GuildMemberships
- BossQuestions
- BossBattleTemplates

### 2. AuthStack (`stacks/AuthStack.ts`)
**Resources:** ~10 resources
- Cognito UserPool
- UserPoolClient
- 3 UserPoolGroups (Students, TeachersPending, Teachers)
- 2 Lambda triggers (PreSignUp, PostConfirmation)
- IAM roles for triggers
- Exports UserPool ID, ARN, and Client ID

**Dependencies:**
- Receives `usersTableName` and `usersTableArn` from DataStack (for PostConfirmation trigger)

### 3. ApiStack (`stacks/ApiStack.ts`)
**Resources:** ~460 resources (under 500 limit)
- API Gateway HTTP API
- ~50 Lambda functions (one per route)
- IAM roles for each Lambda
- S3 Assets bucket
- All API route integrations

**Dependencies:**
- Receives all table names/ARNs from DataStack
- Receives UserPool ID/ARN from AuthStack

## Stack Deployment Order
1. **DataStack** → Creates all tables
2. **AuthStack** → Creates Cognito (needs Users table)
3. **ApiStack** → Creates API + Lambdas (needs tables + Cognito)

## Cross-Stack References
- Table names passed as strings (for Lambda environment variables)
- Table ARNs passed as strings (for IAM policies)
- UserPool ID/ARN passed as strings (for Lambda env vars and IAM)
- No circular dependencies

## Migration Notes
- All existing table names preserved (no data migration needed)
- All API routes unchanged
- All Lambda environment variables unchanged
- IAM permissions functionally equivalent (using ARNs instead of construct references)
- Stack names will change from `{stage}-classquest-ClassQuestStack` to:
  - `{stage}-classquest-DataStack`
  - `{stage}-classquest-AuthStack`
  - `{stage}-classquest-ApiStack`

## Verification
After deployment, verify:
1. `sst synth` shows 3 stacks, all under 500 resources
2. API URL still accessible (check `sst outputs`)
3. All routes functional
4. DynamoDB tables accessible
5. Cognito authentication working

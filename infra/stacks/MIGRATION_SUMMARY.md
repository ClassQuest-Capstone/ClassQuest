# Infrastructure Stack Split - Migration Summary

## Changes Made

### New Files Created

1. **`infra/stacks/DataStack.ts`**
   - Contains all 15 DynamoDB tables
   - Exports table names and ARNs via stack outputs
   - Returns props object with tableNames and tableArns

2. **`infra/stacks/AuthStack.ts`**
   - Contains Cognito UserPool, Client, Groups, and Triggers
   - Accepts usersTableName and usersTableArn as props
   - Exports userPoolId, userPoolArn, and userPoolClientId
   - Uses IAM policy statements instead of bind() for cross-stack table access

3. **`infra/stacks/ApiStack.ts`**
   - Contains API Gateway, all Lambda routes, and S3 bucket
   - Accepts tableNames, tableArns, userPoolId, and userPoolArn as props
   - Uses IAM policy statements with ARNs for table permissions
   - All 50+ API routes preserved exactly as before

### Modified Files

1. **`infra/sst.config.ts`**
   - Removed import of ClassQuestStack
   - Added imports for DataStack, AuthStack, ApiStack
   - Stack deployment order: DataStack → AuthStack → ApiStack
   - Properly wires props between stacks

### Deprecated Files

1. **`infra/stacks/ClassQuestStack.ts.old`**
   - Original monolithic stack (532 resources)
   - Renamed to .old for reference
   - No longer used

### Files Unchanged (Still Used)

1. **`infra/stacks/tables.ts`**
   - Still used by DataStack
   - No changes needed

2. **`infra/stacks/api.ts`**
   - No longer used (logic moved to ApiStack.ts)
   - Could be deleted, but kept for reference

3. **`infra/stacks/auth.ts`**
   - No longer used (logic moved to AuthStack.ts)
   - Could be deleted, but kept for reference

## Resource Distribution

### Before (1 stack):
- **ClassQuestStack**: 532 resources ❌ (exceeds 500 limit)

### After (3 stacks):
- **DataStack**: ~60 resources ✅
  - 15 tables × ~4 resources each (table + GSIs)
- **AuthStack**: ~10 resources ✅
  - UserPool, Client, 3 Groups, 2 Triggers + IAM
- **ApiStack**: ~460 resources ✅
  - API Gateway + ~50 routes × 9 resources each (Lambda + IAM + integration)

**Total: ~530 resources across 3 stacks** ✅ (each stack under 500)

## Deployment Instructions

### First-Time Deployment (After Split)

```bash
# Remove old stack (if exists)
sst remove

# Deploy new split stacks
sst deploy
```

This will create:
- `{stage}-classquest-DataStack`
- `{stage}-classquest-AuthStack`
- `{stage}-classquest-ApiStack`

### Development Workflow

```bash
# Local development (unchanged)
npm run dev

# Deploy to AWS (unchanged)
npm run deploy

# Remove from AWS (will remove all 3 stacks)
npm run remove
```

## Verification Checklist

After deployment, verify:

- [ ] All 3 stacks deployed successfully
- [ ] No stack exceeds 500 resources (check CloudFormation console)
- [ ] API URL accessible (`sst outputs` or check CloudFormation outputs)
- [ ] All DynamoDB tables exist and accessible
- [ ] Cognito UserPool exists with correct groups
- [ ] Test API endpoints still work
- [ ] Authentication flow works
- [ ] Frontend can connect to API

## Breaking Changes

### Stack Names
**Before:**
- `{stage}-classquest-ClassQuestStack`

**After:**
- `{stage}-classquest-DataStack`
- `{stage}-classquest-AuthStack`
- `{stage}-classquest-ApiStack`

### CloudFormation Outputs
Outputs are now distributed across stacks:

**DataStack outputs:**
- All table names (e.g., `UsersTableName`)
- All table ARNs (e.g., `UsersTableArn`)

**AuthStack outputs:**
- `UserPoolId`
- `UserPoolArn`
- `UserPoolClientId`

**ApiStack outputs:**
- `ApiUrl`
- `Region`

### Frontend Environment Variables
Update frontend `.env.local` if using stack outputs:
```bash
# Get new API URL from ApiStack
VITE_API_URL=$(cd infra && sst outputs --stage <stage> ApiStack ApiUrl)

# Get Cognito IDs from AuthStack
VITE_COGNITO_USER_POOL_ID=$(cd infra && sst outputs --stage <stage> AuthStack UserPoolId)
VITE_COGNITO_USER_POOL_CLIENT_ID=$(cd infra && sst outputs --stage <stage> AuthStack UserPoolClientId)
```

## Rollback Plan

If issues occur, rollback by:

1. **Restore old stack:**
   ```bash
   mv infra/stacks/ClassQuestStack.ts.old infra/stacks/ClassQuestStack.ts
   git checkout infra/sst.config.ts
   sst deploy
   ```

2. **Delete new stacks:**
   ```bash
   aws cloudformation delete-stack --stack-name {stage}-classquest-DataStack
   aws cloudformation delete-stack --stack-name {stage}-classquest-AuthStack
   aws cloudformation delete-stack --stack-name {stage}-classquest-ApiStack
   ```

## Technical Details

### Cross-Stack Communication
- **Pass primitives only** (strings for names/ARNs/IDs)
- **No construct references** across stacks (avoids circular deps)
- **IAM permissions** use ARN strings instead of construct grants

### Why This Approach
1. ✅ Minimal code changes
2. ✅ No data migration needed
3. ✅ No runtime behavior changes
4. ✅ Clear separation of concerns
5. ✅ Easy to understand and maintain
6. ✅ Future-proof for scaling beyond 500 resources per domain

### Alternative Approaches (Not Used)
- ❌ Could have nested stacks, but SST doesn't support well
- ❌ Could have split by feature (quests, guilds, etc.), but would create too many stacks
- ❌ Could have used CDK Pipelines, but overkill for this use case

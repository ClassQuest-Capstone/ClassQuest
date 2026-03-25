import { StackContext, Function } from "sst/constructs";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";

type TeacherApiStackProps = {
    apiId: string;
    tableNames: {
        usersTable: string;
        teacherProfilesTable: string;
        studentProfilesTable: string;
        schoolsTable: string;
        classesTable: string;
        classEnrollmentsTable: string;
        questTemplatesTable: string;
        questQuestionsTable: string;
        questInstancesTable: string;
        questQuestionResponsesTable: string;
        playerStatesTable: string;
        guildsTable: string;
        guildMembershipsTable: string;
        bossQuestionsTable: string;
        bossBattleTemplatesTable: string;
        rewardMilestonesTable: string;
        studentRewardClaimsTable: string;
    };
    tableArns: {
        usersTable: string;
        teacherProfilesTable: string;
        studentProfilesTable: string;
        schoolsTable: string;
        classesTable: string;
        classEnrollmentsTable: string;
        questTemplatesTable: string;
        questQuestionsTable: string;
        questInstancesTable: string;
        questQuestionResponsesTable: string;
        playerStatesTable: string;
        guildsTable: string;
        guildMembershipsTable: string;
        bossQuestionsTable: string;
        bossBattleTemplatesTable: string;
        rewardMilestonesTable: string;
        studentRewardClaimsTable: string;
    };
    userPoolId: string;
    userPoolArn: string;
};

/**
 * TeacherApiStack - Teacher domain routes
 * Uses a single router Lambda (teacher-router/router.ts) instead of one Lambda per route.
 * This keeps the CloudFormation template well under the 1 MB limit.
 */
export function TeacherApiStack(ctx: StackContext, props: TeacherApiStackProps) {
    const { stack } = ctx;
    const { apiId, tableNames, tableArns, userPoolId, userPoolArn } = props;

    // Define routes — method + path must exactly match what the router dispatch table uses
    const routes: Record<string, { method: string; path: string }> = {
        // Schools
        "GET /schools": { method: "GET", path: "/schools" },
        "POST /schools": { method: "POST", path: "/schools" },
        "GET /schools/{school_id}": { method: "GET", path: "/schools/{school_id}" },

        // TeacherProfiles
        "POST /teacher-profiles": { method: "POST", path: "/teacher-profiles" },
        "GET /teacher-profiles/{teacher_id}": { method: "GET", path: "/teacher-profiles/{teacher_id}" },
        "GET /schools/{school_id}/teachers": { method: "GET", path: "/schools/{school_id}/teachers" },

        // Classes
        "POST /classes": { method: "POST", path: "/classes" },
        "GET /classes/{class_id}": { method: "GET", path: "/classes/{class_id}" },
        "GET /classes/join/{join_code}": { method: "GET", path: "/classes/join/{join_code}" },
        "GET /teachers/{teacher_id}/classes": { method: "GET", path: "/teachers/{teacher_id}/classes" },
        "GET /schools/{school_id}/classes": { method: "GET", path: "/schools/{school_id}/classes" },
        "PATCH /classes/{class_id}/deactivate": { method: "PATCH", path: "/classes/{class_id}/deactivate" },
        "PATCH /classes/{class_id}":            { method: "PATCH", path: "/classes/{class_id}" },

        // ClassEnrollments
        "POST /classes/{class_id}/enroll": { method: "POST", path: "/classes/{class_id}/enroll" },
        "DELETE /enrollments/{enrollment_id}": { method: "DELETE", path: "/enrollments/{enrollment_id}" },
        "GET /classes/{class_id}/students": { method: "GET", path: "/classes/{class_id}/students" },
        "GET /students/{student_id}/classes": { method: "GET", path: "/students/{student_id}/classes" },
        "GET /enrollments/{enrollment_id}": { method: "GET", path: "/enrollments/{enrollment_id}" },
        "POST /classes/{class_id}/students/{student_id}/restore": { method: "POST", path: "/classes/{class_id}/students/{student_id}/restore" },

        // QuestInstances
        "POST /classes/{class_id}/quest-instances": { method: "POST", path: "/classes/{class_id}/quest-instances" },
        "GET /quest-instances/{quest_instance_id}": { method: "GET", path: "/quest-instances/{quest_instance_id}" },
        "GET /classes/{class_id}/quest-instances": { method: "GET", path: "/classes/{class_id}/quest-instances" },
        "GET /quest-templates/{quest_template_id}/quest-instances": { method: "GET", path: "/quest-templates/{quest_template_id}/quest-instances" },
        "PATCH /quest-instances/{quest_instance_id}/status": { method: "PATCH", path: "/quest-instances/{quest_instance_id}/status" },
        "PATCH /quest-instances/{quest_instance_id}/dates": { method: "PATCH", path: "/quest-instances/{quest_instance_id}/dates" },

        // Guilds
        "POST /classes/{class_id}/guilds": { method: "POST", path: "/classes/{class_id}/guilds" },
        "GET /guilds/{guild_id}": { method: "GET", path: "/guilds/{guild_id}" },
        "GET /classes/{class_id}/guilds": { method: "GET", path: "/classes/{class_id}/guilds" },
        "PATCH /guilds/{guild_id}": { method: "PATCH", path: "/guilds/{guild_id}" },
        "PATCH /guilds/{guild_id}/deactivate": { method: "PATCH", path: "/guilds/{guild_id}/deactivate" },

        // GuildMemberships
        "PUT /classes/{class_id}/guild-memberships/{student_id}": { method: "PUT", path: "/classes/{class_id}/guild-memberships/{student_id}" },
        "GET /classes/{class_id}/guild-memberships/{student_id}": { method: "GET", path: "/classes/{class_id}/guild-memberships/{student_id}" },
        "GET /guilds/{guild_id}/members": { method: "GET", path: "/guilds/{guild_id}/members" },
        "GET /students/{student_id}/guild-memberships": { method: "GET", path: "/students/{student_id}/guild-memberships" },
        "PATCH /classes/{class_id}/guild-memberships/{student_id}/leave": { method: "PATCH", path: "/classes/{class_id}/guild-memberships/{student_id}/leave" },

        // RewardMilestones
        "POST /teacher/rewards":                                   { method: "POST",   path: "/teacher/rewards" },
        "GET /teacher/rewards/{reward_id}":                        { method: "GET",    path: "/teacher/rewards/{reward_id}" },
        "GET /teacher/classes/{class_id}/rewards":                 { method: "GET",    path: "/teacher/classes/{class_id}/rewards" },
        "GET /teacher/rewards":                                    { method: "GET",    path: "/teacher/rewards" },
        "PUT /teacher/rewards/{reward_id}":                        { method: "PUT",    path: "/teacher/rewards/{reward_id}" },
        "PATCH /teacher/rewards/{reward_id}/status":               { method: "PATCH",  path: "/teacher/rewards/{reward_id}/status" },
        "DELETE /teacher/rewards/{reward_id}":                     { method: "DELETE", path: "/teacher/rewards/{reward_id}" },
        "PATCH /teacher/rewards/{reward_id}/restore":              { method: "PATCH",  path: "/teacher/rewards/{reward_id}/restore" },

        // StudentRewardClaims (internal/admin routes)
        "POST /internal/student-reward-claims":                                          { method: "POST", path: "/internal/student-reward-claims" },
        "GET /internal/student-reward-claims/{claim_id}":                                { method: "GET",  path: "/internal/student-reward-claims/{claim_id}" },
        "GET /internal/students/{student_id}/reward-claims":                             { method: "GET",  path: "/internal/students/{student_id}/reward-claims" },
        "POST /internal/students/{student_id}/reward-claims/level-up-sync":              { method: "POST", path: "/internal/students/{student_id}/reward-claims/level-up-sync" },

        // ImageUpload — teacher-only presigned S3 PUT URL
        "POST /teacher/images/upload-url": { method: "POST", path: "/teacher/images/upload-url" },
    };

    // ── S3 ASSETS BUCKET (teacher image uploads) ─────────────────────────────
    // Images are uploaded directly from the browser via presigned PUT URLs.
    // DynamoDB records store only the S3 object key (image_asset_key), not the URL.
    // CloudFront serves images from this private bucket — see distribution below.
    // TODO later: decide whether detached images should be deleted from S3 immediately
    //             or cleaned up by a background job when image_asset_key is cleared.
    const assetsBucket = new s3.Bucket(stack, "TeacherAssets", {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        cors: [
            {
                // CORS is only needed for the browser → S3 presigned PUT upload path.
                // Image delivery goes through CloudFront, not direct S3 GET.
                allowedMethods: [s3.HttpMethods.PUT],
                allowedOrigins: ["*"],
                allowedHeaders: ["*"],
                maxAge: 3000,
            },
        ],
    });

    // ── CLOUDFRONT DISTRIBUTION (read-only delivery from private bucket) ─────
    // CloudFront reads from S3 via OAI — bucket stays private.
    // Frontend builds asset URLs as: ${VITE_ASSETS_CDN_URL}/${image_asset_key}
    // Signed URLs / per-user restrictions are intentionally deferred (MVP).
    const oai = new cloudfront.OriginAccessIdentity(stack, "TeacherAssetsOAI", {
        comment: "ClassQuest teacher assets — OAI for private S3 read",
    });
    assetsBucket.grantRead(oai);

    const assetsCdn = new cloudfront.Distribution(stack, "TeacherAssetsCdn", {
        defaultBehavior: {
            origin: new origins.S3Origin(assetsBucket, {
                originAccessIdentity: oai,
            }),
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        comment: "ClassQuest teacher assets CDN",
    });

    // ── ROUTER LAMBDA (replaces individual Lambdas) ──────────────────────────
    const tableArnList = Object.values(tableArns);

    const teacherRouter = new Function(stack, "TeacherRouter", {
        handler: "packages/functions/src/teacher-router/router.handler",
        environment: {
            USERS_TABLE_NAME:                         tableNames.usersTable,
            STUDENT_PROFILES_TABLE_NAME:              tableNames.studentProfilesTable,
            TEACHER_PROFILES_TABLE_NAME:              tableNames.teacherProfilesTable,
            SCHOOLS_TABLE_NAME:                       tableNames.schoolsTable,
            CLASSES_TABLE_NAME:                       tableNames.classesTable,
            CLASS_ENROLLMENTS_TABLE_NAME:             tableNames.classEnrollmentsTable,
            QUEST_TEMPLATES_TABLE_NAME:               tableNames.questTemplatesTable,
            QUEST_QUESTIONS_TABLE_NAME:               tableNames.questQuestionsTable,
            QUEST_INSTANCES_TABLE_NAME:               tableNames.questInstancesTable,
            QUEST_QUESTION_RESPONSES_TABLE_NAME:      tableNames.questQuestionResponsesTable,
            PLAYER_STATES_TABLE_NAME:                 tableNames.playerStatesTable,
            GUILDS_TABLE_NAME:                        tableNames.guildsTable,
            GUILD_MEMBERSHIPS_TABLE_NAME:             tableNames.guildMembershipsTable,
            BOSS_QUESTIONS_TABLE_NAME:                tableNames.bossQuestionsTable,
            BOSS_BATTLE_TEMPLATES_TABLE_NAME:         tableNames.bossBattleTemplatesTable,
            REWARD_MILESTONES_TABLE_NAME:             tableNames.rewardMilestonesTable,
            STUDENT_REWARD_CLAIMS_TABLE_NAME:         tableNames.studentRewardClaimsTable,
            USER_POOL_ID:                             userPoolId,
            ASSETS_BUCKET_NAME:                       assetsBucket.bucketName,
        },
        timeout: 30,
        memorySize: 512,
    });

    teacherRouter.attachPermissions([
        new iam.PolicyStatement({
            actions: [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
            ],
            resources: [
                ...tableArnList,
                ...tableArnList.map(arn => `${arn}/index/*`),
            ],
        }),
        new iam.PolicyStatement({
            actions: [
                "cognito-idp:AdminSetUserPassword",
                "cognito-idp:AdminUpdateUserAttributes",
                "cognito-idp:AdminGetUser",
                "cognito-idp:AdminCreateUser",
                "cognito-idp:AdminAddUserToGroup",
            ],
            resources: [userPoolArn],
        }),
        new iam.PolicyStatement({
            actions: ["s3:PutObject"],
            resources: [assetsBucket.arnForObjects("teachers/*")],
        }),
    ]);

    const sharedIntegration = new apigatewayv2.CfnIntegration(stack, "TeacherRouterIntegration", {
        apiId,
        integrationType: "AWS_PROXY",
        integrationUri: teacherRouter.functionArn,
        payloadFormatVersion: "2.0",
    });

    teacherRouter.addPermission("TeacherRouterInvokePermission", {
        principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
        sourceArn: `arn:aws:execute-api:${stack.region}:${stack.account}:${apiId}/*`,
    });

    // Create one CfnRoute per endpoint — all pointing to the shared router integration
    Object.entries(routes).forEach(([routeKey, config]) => {
        const funcId = routeKey.replace(/[^a-zA-Z0-9]/g, "");
        new apigatewayv2.CfnRoute(stack, `${funcId}Route`, {
            apiId,
            routeKey: `${config.method} ${config.path}`,
            target: `integrations/${sharedIntegration.ref}`,
        });
    });

    stack.addOutputs({
        TeacherAssetsBucketName: assetsBucket.bucketName,
        // Use this domain in VITE_ASSETS_CDN_URL: https://<TeacherAssetsCdnDomain>
        TeacherAssetsCdnDomain: assetsCdn.distributionDomainName,
    });
    return {};
}

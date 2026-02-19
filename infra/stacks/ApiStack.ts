import { StackContext, Api, Bucket } from "sst/constructs";
import * as iam from "aws-cdk-lib/aws-iam";

type ApiStackProps = {
    // Table names for environment variables
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
    };
    // Table ARNs for IAM permissions
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
    };
    // Cognito references
    userPoolId: string;
    userPoolArn: string;
};

/**
 * ApiStack - Contains API Gateway, Lambda functions, and S3 bucket
 * Uses table names/ARNs and Cognito IDs from other stacks
 */
export function ApiStack(ctx: StackContext, props: ApiStackProps) {
    const { stack } = ctx;
    const { tableNames, tableArns, userPoolId, userPoolArn } = props;

    // Assets bucket
    const assetsBucket = new Bucket(stack, "Assets");

    // API Gateway with all routes
    const api = new Api(stack, "HttpApi", {
        cors: {
            allowOrigins: ["http://localhost:5000"],
            allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowHeaders: ["content-type", "authorization"],
        },

        routes: {
            "GET /health": "packages/functions/src/health.handler",

            // Schools
            "GET /schools": "packages/functions/src/schools/list.handler",
            "POST /schools": "packages/functions/src/schools/create.handler",
            "GET /schools/{school_id}": "packages/functions/src/schools/get.handler",

            // StudentProfiles
            "POST /student-profiles": "packages/functions/src/student-profiles/create.handler",
            "GET /student-profiles/{student_id}": "packages/functions/src/student-profiles/get.handler",
            "PATCH /student-profiles/{student_id}": "packages/functions/src/student-profiles/update.handler",
            "GET /schools/{school_id}/students": "packages/functions/src/student-profiles/list-by-school.handler",
            "POST /students/{student_id}/set-password": "packages/functions/src/student-profiles/set-password.handler",

            // TeacherProfiles
            "POST /teacher-profiles": "packages/functions/src/teacher-profiles/create.handler",
            "GET /teacher-profiles/{teacher_id}": "packages/functions/src/teacher-profiles/get.handler",
            "GET /schools/{school_id}/teachers": "packages/functions/src/teacher-profiles/list-by-school.handler",

            // Classes
            "POST /classes": "packages/functions/src/classes/create.handler",
            "GET /classes/{class_id}": "packages/functions/src/classes/get.handler",
            "GET /classes/join/{join_code}": "packages/functions/src/classes/get-by-join-code.handler",
            "GET /teachers/{teacher_id}/classes": "packages/functions/src/classes/list-by-teacher.handler",
            "GET /schools/{school_id}/classes": "packages/functions/src/classes/list-by-school.handler",
            "PATCH /classes/{class_id}/deactivate": "packages/functions/src/classes/deactivate.handler",

            // ClassEnrollments
            "POST /classes/{class_id}/enroll": "packages/functions/src/classEnrollments/enroll.handler",
            "DELETE /enrollments/{enrollment_id}": "packages/functions/src/classEnrollments/unenroll.handler",
            "GET /classes/{class_id}/students": "packages/functions/src/classEnrollments/list-by-class.handler",
            "GET /students/{student_id}/classes": "packages/functions/src/classEnrollments/list-by-student.handler",
            "GET /enrollments/{enrollment_id}": "packages/functions/src/classEnrollments/get.handler",

            // QuestTemplates
            "POST /quest-templates": "packages/functions/src/questTemplates/create.handler",
            "GET /quest-templates/public": "packages/functions/src/questTemplates/list-public.handler",
            "GET /quest-templates/{quest_template_id}": "packages/functions/src/questTemplates/get.handler",
            "GET /teachers/{teacher_id}/quest-templates": "packages/functions/src/questTemplates/list-by-owner.handler",
            "PATCH /quest-templates/{quest_template_id}": "packages/functions/src/questTemplates/update.handler",
            "PATCH /quest-templates/{quest_template_id}/soft-delete": "packages/functions/src/questTemplates/soft-delete.handler",

            // QuestQuestions
            "POST /quest-templates/{template_id}/questions": "packages/functions/src/questQuestions/create.handler",
            "GET /quest-templates/{template_id}/questions": "packages/functions/src/questQuestions/list-by-template.handler",
            "GET /quest-questions/{question_id}": "packages/functions/src/questQuestions/get.handler",
            "PATCH /quest-questions/{question_id}": "packages/functions/src/questQuestions/update.handler",
            "DELETE /quest-questions/{question_id}": "packages/functions/src/questQuestions/delete.handler",

            // QuestInstances
            "POST /classes/{class_id}/quest-instances": "packages/functions/src/questInstances/create.handler",
            "GET /quest-instances/{quest_instance_id}": "packages/functions/src/questInstances/get.handler",
            "GET /classes/{class_id}/quest-instances": "packages/functions/src/questInstances/list-by-class.handler",
            "GET /quest-templates/{quest_template_id}/quest-instances": "packages/functions/src/questInstances/list-by-template.handler",
            "PATCH /quest-instances/{quest_instance_id}/status": "packages/functions/src/questInstances/update-status.handler",
            "PATCH /quest-instances/{quest_instance_id}/dates": "packages/functions/src/questInstances/update-dates.handler",

            // QuestQuestionResponses
            "PUT /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}": "packages/functions/src/questQuestionResponses/upsert-response.handler",
            "GET /quest-instances/{quest_instance_id}/responses/{student_id}": "packages/functions/src/questQuestionResponses/get-by-instance-and-student.handler",
            "GET /quest-instances/{quest_instance_id}/responses": "packages/functions/src/questQuestionResponses/list-by-instance.handler",
            "GET /students/{student_id}/responses": "packages/functions/src/questQuestionResponses/list-by-student.handler",
            "GET /questions/{question_id}/responses": "packages/functions/src/questQuestionResponses/list-by-question.handler",
            "PATCH /quest-instances/{quest_instance_id}/questions/{question_id}/responses/{student_id}/grade": "packages/functions/src/questQuestionResponses/grade-response.handler",

            // PlayerStates
            "PUT /classes/{class_id}/players/{student_id}/state": "packages/functions/src/playerStates/upsert-state.handler",
            "GET /classes/{class_id}/players/{student_id}/state": "packages/functions/src/playerStates/get.handler",
            "GET /classes/{class_id}/leaderboard": "packages/functions/src/playerStates/get-leaderboard.handler",

            // Guilds
            "POST /classes/{class_id}/guilds": "packages/functions/src/guilds/create.handler",
            "GET /guilds/{guild_id}": "packages/functions/src/guilds/get.handler",
            "GET /classes/{class_id}/guilds": "packages/functions/src/guilds/list-by-class.handler",
            "PATCH /guilds/{guild_id}": "packages/functions/src/guilds/update.handler",
            "PATCH /guilds/{guild_id}/deactivate": "packages/functions/src/guilds/deactivate.handler",

            // GuildMemberships
            "PUT /classes/{class_id}/guild-memberships/{student_id}": "packages/functions/src/guildMemberships/upsert-membership.handler",
            "GET /classes/{class_id}/guild-memberships/{student_id}": "packages/functions/src/guildMemberships/get.handler",
            "GET /guilds/{guild_id}/members": "packages/functions/src/guildMemberships/list-by-guild.handler",
            "GET /students/{student_id}/guild-memberships": "packages/functions/src/guildMemberships/list-by-student.handler",
            "PATCH /classes/{class_id}/guild-memberships/{student_id}/leave": "packages/functions/src/guildMemberships/leave.handler",

            // BossQuestions
            "POST /boss-templates/{boss_template_id}/questions": "packages/functions/src/bossQuestions/create.handler",
            "GET /boss-questions/{question_id}": "packages/functions/src/bossQuestions/get.handler",
            "GET /boss-templates/{boss_template_id}/questions": "packages/functions/src/bossQuestions/list-by-template.handler",
            "PATCH /boss-questions/{question_id}": "packages/functions/src/bossQuestions/update.handler",
            "DELETE /boss-questions/{question_id}": "packages/functions/src/bossQuestions/delete.handler",

            // BossBattleTemplates
            "POST /boss-battle-templates": "packages/functions/src/bossBattleTemplates/create.handler",
            "GET /boss-battle-templates/{boss_template_id}": "packages/functions/src/bossBattleTemplates/get.handler",
            "GET /teachers/{teacher_id}/boss-battle-templates": "packages/functions/src/bossBattleTemplates/list-by-owner.handler",
            "GET /boss-battle-templates/public": "packages/functions/src/bossBattleTemplates/list-public.handler",
        },
        defaults: {
            function: {
                environment: {
                    USERS_TABLE_NAME: tableNames.usersTable,
                    STUDENT_PROFILES_TABLE_NAME: tableNames.studentProfilesTable,
                    TEACHER_PROFILES_TABLE_NAME: tableNames.teacherProfilesTable,
                    SCHOOLS_TABLE_NAME: tableNames.schoolsTable,
                    CLASSES_TABLE_NAME: tableNames.classesTable,
                    CLASS_ENROLLMENTS_TABLE_NAME: tableNames.classEnrollmentsTable,
                    QUEST_TEMPLATES_TABLE_NAME: tableNames.questTemplatesTable,
                    QUEST_QUESTIONS_TABLE_NAME: tableNames.questQuestionsTable,
                    QUEST_INSTANCES_TABLE_NAME: tableNames.questInstancesTable,
                    QUEST_QUESTION_RESPONSES_TABLE_NAME: tableNames.questQuestionResponsesTable,
                    PLAYER_STATES_TABLE_NAME: tableNames.playerStatesTable,
                    GUILDS_TABLE_NAME: tableNames.guildsTable,
                    GUILD_MEMBERSHIPS_TABLE_NAME: tableNames.guildMembershipsTable,
                    BOSS_QUESTIONS_TABLE_NAME: tableNames.bossQuestionsTable,
                    BOSS_BATTLE_TEMPLATES_TABLE_NAME: tableNames.bossBattleTemplatesTable,
                    USER_POOL_ID: userPoolId,
                },
            },
        },
    });

    // Attach permissions for all tables using ARNs
    const tableArnList = Object.values(tableArns);
    api.attachPermissions([
        // DynamoDB table permissions
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
                // Also grant access to GSIs
                ...tableArnList.map(arn => `${arn}/index/*`),
            ],
        }),
        // Cognito permissions for password management and user attribute updates
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
    ]);

    // Export API URL and other outputs
    stack.addOutputs({
        ApiUrl: api.url,
        Region: stack.region,
    });

    return {
        api,
        assetsBucket,
    };
}

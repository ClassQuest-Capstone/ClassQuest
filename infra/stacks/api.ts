import { StackContext, Api } from "sst/constructs";
import type { Table } from "sst/constructs";
import type * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";

// file focused: routes + shared defaults only.
export function createApi(
    stack: StackContext["stack"],
    tables: {
        usersTable: Table;
        studentProfilesTable: Table;
        teacherProfilesTable: Table;
        schoolsTable: Table;
        classesTable: Table;
        classEnrollmentsTable: Table;
        questTemplatesTable: Table;
        questQuestionsTable: Table;
        questInstancesTable: Table;
        questQuestionResponsesTable: Table;
        playerStatesTable: Table;
        guildsTable: Table;
        guildMembershipsTable: Table;
    },
    userPool: cognito.UserPool
    ) {
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
        },
        defaults: {
        function: {
            environment: {
            USERS_TABLE_NAME: tables.usersTable.tableName,
            STUDENT_PROFILES_TABLE_NAME: tables.studentProfilesTable.tableName,
            TEACHER_PROFILES_TABLE_NAME: tables.teacherProfilesTable.tableName,
            SCHOOLS_TABLE_NAME: tables.schoolsTable.tableName,
            CLASSES_TABLE_NAME: tables.classesTable.tableName,
            CLASS_ENROLLMENTS_TABLE_NAME: tables.classEnrollmentsTable.tableName,
            QUEST_TEMPLATES_TABLE_NAME: tables.questTemplatesTable.tableName,
            QUEST_QUESTIONS_TABLE_NAME: tables.questQuestionsTable.tableName,
            QUEST_INSTANCES_TABLE_NAME: tables.questInstancesTable.tableName,
            QUEST_QUESTION_RESPONSES_TABLE_NAME: tables.questQuestionResponsesTable.tableName,
            PLAYER_STATES_TABLE_NAME: tables.playerStatesTable.tableName,
            GUILDS_TABLE_NAME: tables.guildsTable.tableName,
            GUILD_MEMBERSHIPS_TABLE_NAME: tables.guildMembershipsTable.tableName,
            USER_POOL_ID: userPool.userPoolId,
            },
        },
        },
    });

    // Give lambdas permission to read/write these tables
    api.attachPermissions([
        tables.usersTable,
        tables.studentProfilesTable,
        tables.teacherProfilesTable,
        tables.schoolsTable,
        tables.classesTable,
        tables.classEnrollmentsTable,
        tables.questTemplatesTable,
        tables.questQuestionsTable,
        tables.questInstancesTable,
        tables.questQuestionResponsesTable,
        tables.playerStatesTable,
        tables.guildsTable,
        tables.guildMembershipsTable,
        // Cognito permissions for password management and user attribute updates
        new iam.PolicyStatement({
            actions: [
                "cognito-idp:AdminSetUserPassword",
                "cognito-idp:AdminUpdateUserAttributes",
                "cognito-idp:AdminGetUser",
            ],
            resources: [userPool.userPoolArn],
        }),
    ]);

    return api;
}

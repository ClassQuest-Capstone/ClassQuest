import { StackContext, Api } from "sst/constructs";
import type { Table } from "sst/constructs";

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
    }
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
        "GET /schools/{school_id}/students": "packages/functions/src/student-profiles/list-by-school.handler",
            

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

        // QuestQuestions
        "POST /quest-templates/{template_id}/questions": "packages/functions/src/questQuestions/create.handler",
        "GET /quest-templates/{template_id}/questions": "packages/functions/src/questQuestions/list-by-template.handler",
        "GET /quest-questions/{question_id}": "packages/functions/src/questQuestions/get.handler",
        "PATCH /quest-questions/{question_id}": "packages/functions/src/questQuestions/update.handler",
        "DELETE /quest-questions/{question_id}": "packages/functions/src/questQuestions/delete.handler",
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
    ]);

    return api;
}

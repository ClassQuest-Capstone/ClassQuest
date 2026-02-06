import { StackContext, Table } from "sst/constructs";

export function createTables(ctx: StackContext) {
    const { stack } = ctx;

    // Users table
    const usersTable = new Table(stack, "Users", {
        fields: {
            user_id: "string",
            cognito_sub: "string",
            role: "string",
            status: "string",
            created_at: "string",
            last_login_at: "string",
        },
        primaryIndex: { partitionKey: "user_id" },
        globalIndexes: {
            gsi1: { partitionKey: "cognito_sub" },
        },
    });

    // TeacherProfiles table
    const teacherProfilesTable = new Table(stack, "TeacherProfiles", {
        fields: {
            teacher_id: "string",
            school_id: "string",
            display_name: "string",
            email: "string",
            created_at: "string",
            updated_at: "string",
        },
        primaryIndex: { partitionKey: "teacher_id" },
        globalIndexes: {
            gsi1: { partitionKey: "school_id" },     
        },
    });

    // StudentProfiles table
    const studentProfilesTable = new Table(stack, "StudentProfiles", {
        fields: {
            student_id: "string",
            school_id: "string",
            display_name: "string",
            email: "string",
            grade: "string",
            created_at: "string",
            updated_at: "string",
        },
        primaryIndex: { partitionKey: "student_id" },
        globalIndexes: {
            gsi1: { partitionKey: "school_id" },
        },
    });

    // Schools table
    const schoolsTable = new Table(stack, "Schools", {
        fields: {
            school_id: "string",
            name: "string",
            division: "string",
            city: "string",
            province: "string",
            created_at: "string",
            updated_at: "string",
        },
        primaryIndex: { partitionKey: "school_id" },
    });

    // Classes table
    const classesTable = new Table(stack, "Classes", {
        fields: {
            class_id: "string",
            created_by_teacher_id: "string",
            school_id: "string",
            join_code: "string",
        },
        primaryIndex: { partitionKey: "class_id" },
        globalIndexes: {
            GSI1: { partitionKey: "created_by_teacher_id" }, // by teacher
            GSI2: { partitionKey: "school_id" },             // by school
            GSI3: { partitionKey: "join_code" },             // by join code
        },
    });

    // ClassEnrollments table - links students to classes
    const classEnrollmentsTable = new Table(stack, "ClassEnrollments", {
    fields: {
        enrollment_id: "string",
        class_id: "string",
        student_id: "string",
        joined_at: "string",
        status: "string",
    },
    primaryIndex: { partitionKey: "enrollment_id" },
    globalIndexes: {
        gsi1: { partitionKey: "class_id" },   // by class
        gsi2: { partitionKey: "student_id" }, // by student
    },
    });

    // QuestTemplates table - reusable quest templates for teachers
    const questTemplatesTable = new Table(stack, "QuestTemplates", {
        fields: {
            quest_template_id: "string",
            owner_teacher_id: "string",
            visibility_pk: "string",    // "PUBLIC" or "PRIVATE"
            public_sort: "string",      // subject#grade#difficulty#created_at
        },
        primaryIndex: { partitionKey: "quest_template_id" },
        globalIndexes: {
            gsi1: { partitionKey: "owner_teacher_id" },  // list by teacher
            gsi2: {                                       // public library with filtering
                partitionKey: "visibility_pk",
                sortKey: "public_sort",
            },
        },
    });

    // QuestQuestions table - questions belonging to quest templates
    const questQuestionsTable = new Table(stack, "QuestQuestions", {
        fields: {
            question_id: "string",
            quest_template_id: "string",
            order_key: "string",  // zero-padded like "0001" for ordering
        },
        primaryIndex: { partitionKey: "question_id" },
        globalIndexes: {
            gsi1: {  // list questions by template in order
                partitionKey: "quest_template_id",
                sortKey: "order_key",
            },
        },
    });

    return {
        usersTable,
        teacherProfilesTable,
        studentProfilesTable,
        schoolsTable,
        classesTable,
        classEnrollmentsTable,
        questTemplatesTable,
        questQuestionsTable,
    };
}
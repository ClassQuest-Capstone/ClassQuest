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
            //school_id: "string",
            display_name: "string",
            email: "string",
            created_at: "string",
            updated_at: "string",
        },
        primaryIndex: { partitionKey: "teacher_id" },
        globalIndexes: {
            //gsi1: { partitionKey: "school_id" },
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

    return {
        usersTable,
        teacherProfilesTable,
        studentProfilesTable,
        schoolsTable,
        classesTable,
    };
}
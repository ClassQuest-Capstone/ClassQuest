import { StackContext, Bucket, Table, Api } from "sst/constructs";

export function ClassQuestStack({ stack }: StackContext) {
    const assetsBucket = new Bucket(stack, "Assets");

    const gameTable = new Table(stack, "GameTable", {
        fields: {
            pk: "string",
            sk: "string",
            gsi1pk: "string",
            gsi1sk: "string",
        },
        primaryIndex: { partitionKey: "pk", sortKey: "sk" },
        globalIndexes: {
            gsi1: { partitionKey: "gsi1pk", sortKey: "gsi1sk" },
        },
    });

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
            teacher_id: "string",  // equals Users.user_id
            school_id: "string",
            display_name: "string",
            email: "string",
            created_at: "string",
            updated_at: "string",
        },
        primaryIndex: { partitionKey: "teacher_id" },
        globalIndexes: {
            // list all teachers in a school
            gsi1: { partitionKey: "school_id" },
        },
    });

    // StudentProfiles table (Phase A)
    const studentProfilesTable = new Table(stack, "StudentProfiles", {
        fields: {
            student_id: "string",  // equals Users.user_id
            school_id: "string",
            display_name: "string",
            email: "string",
            grade: "string",
            created_at: "string",
            updated_at: "string",
        },
        primaryIndex: { partitionKey: "student_id" },
        globalIndexes: {
        // list all students in a school
        gsi1: { partitionKey: "school_id" },
        },
    });

    const api = new Api(stack, "HttpApi", {
        routes: {
        "GET /health": "functions/src/health.handler",
        "POST /debug": "functions/src/debug-create.handler",
        },
        defaults: {
        function: {
            environment: {
            TABLE_NAME: gameTable.tableName,
            USERS_TABLE_NAME: usersTable.tableName,
            TEACHER_PROFILES_TABLE_NAME: teacherProfilesTable.tableName,
            STUDENT_PROFILES_TABLE_NAME: studentProfilesTable.tableName,
            },
        },
        },
    });

    api.attachPermissions([
        gameTable, usersTable, teacherProfilesTable, studentProfilesTable
    ]);

    stack.addOutputs({
        AssetsBucketName: assetsBucket.bucketName,
        GameTableName: gameTable.tableName,
        UsersTableName: usersTable.tableName,
        TeacherProfilesTableName: teacherProfilesTable.tableName,
        StudentProfilesTableName: studentProfilesTable.tableName,
        ApiUrl: api.url,
    });
}

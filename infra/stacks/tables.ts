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
            username: "string",
            grade: "string",
            created_at: "string",
            updated_at: "string",
        },
        primaryIndex: { partitionKey: "student_id" },
        globalIndexes: {
            gsi1: { partitionKey: "school_id" },
            gsi2: { partitionKey: "username" },
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

    // QuestInstances table - active quests assigned to classes
    const questInstancesTable = new Table(stack, "QuestInstances", {
        fields: {
            quest_instance_id: "string",
            quest_template_id: "string",  // nullable - can be null for custom quests
            class_id: "string",
            title_override: "string",
            description_override: "string",
            status: "string",             // DRAFT | ACTIVE | ARCHIVED
            start_date: "string",         // ISO date string
            due_date: "string",           // ISO date string
            requires_manual_approval: "string",  // stored as string for DynamoDB
        },
        primaryIndex: { partitionKey: "quest_instance_id" },
        globalIndexes: {
            gsi1: { partitionKey: "class_id" },           // list quests by class
            gsi2: { partitionKey: "quest_template_id" },  // list instances by template (nullable)
        },
    });

    // QuestQuestionResponses table - student answers to quest questions (v2 with uniqueness)
    const questQuestionResponsesTable = new Table(stack, "QuestQuestionResponses", {
        fields: {
            instance_student_pk: "string",  // PK: quest_instance_id#student_id
            question_id: "string",          // SK: question_id
            response_id: "string",          // UUID for audit
            quest_instance_id: "string",
            student_id: "string",
            class_id: "string",
            submitted_at: "string",         // ISO timestamp
            gsi1sk: "string",               // submitted_at#student_id#question_id
            gsi2sk: "string",               // submitted_at#quest_instance_id#question_id
            gsi3sk: "string",               // submitted_at#student_id#quest_instance_id
        },
        primaryIndex: {
            partitionKey: "instance_student_pk",
            sortKey: "question_id"
        },
        globalIndexes: {
            gsi1: {  // by instance
                partitionKey: "quest_instance_id",
                sortKey: "gsi1sk"
            },
            gsi2: {  // by student
                partitionKey: "student_id",
                sortKey: "gsi2sk"
            },
            gsi3: {  // by question
                partitionKey: "question_id",
                sortKey: "gsi3sk"
            },
        },
    });

    // PlayerStates table - one player state per student per class
    const playerStatesTable = new Table(stack, "PlayerStates", {
        fields: {
            class_id: "string",           // PK: class
            student_id: "string",         // SK: student
            leaderboard_sort: "string",   // GSI1 SK: inverted XP for descending leaderboard
        },
        primaryIndex: {
            partitionKey: "class_id",
            sortKey: "student_id"
        },
        globalIndexes: {
            gsi1: {  // leaderboard by class (descending XP order via inverted sort key)
                partitionKey: "class_id",
                sortKey: "leaderboard_sort"
            },
        },
    });

    // Guilds table - student teams within a class
    const guildsTable = new Table(stack, "Guilds", {
        fields: {
            guild_id: "string",         // PK: guild UUID
            class_id: "string",         // GSI1 PK: for listing guilds by class
            gsi1sk: "string",           // GSI1 SK: created_at#guild_id (stable ordering)
        },
        primaryIndex: {
            partitionKey: "guild_id"
        },
        globalIndexes: {
            gsi1: {  // list guilds by class, ordered by creation time
                partitionKey: "class_id",
                sortKey: "gsi1sk"
            },
        },
    });

    // GuildMemberships table - one membership per (class_id, student_id)
    const guildMembershipsTable = new Table(stack, "GuildMemberships", {
        fields: {
            class_id: "string",         // PK: class
            student_id: "string",       // SK: student (ensures one guild per student per class)
            guild_id: "string",         // GSI1 PK: for listing members by guild
            gsi1sk: "string",           // GSI1 SK: joined_at#student_id
            gsi2sk: "string",           // GSI2 SK: joined_at#class_id#guild_id
        },
        primaryIndex: {
            partitionKey: "class_id",
            sortKey: "student_id"
        },
        globalIndexes: {
            gsi1: {  // list members by guild (roster)
                partitionKey: "guild_id",
                sortKey: "gsi1sk"
            },
            gsi2: {  // list student's memberships across classes
                partitionKey: "student_id",
                sortKey: "gsi2sk"
            },
        },
    });

    // BossQuestions table - questions for boss battle templates
    const bossQuestionsTable = new Table(stack, "BossQuestions", {
        fields: {
            question_id: "string",        // PK: UUID
            boss_template_id: "string",   // GSI1 PK: parent boss template
            order_key: "string",          // GSI1 SK: zero-padded order (e.g., "000001")
        },
        primaryIndex: {
            partitionKey: "question_id"
        },
        globalIndexes: {
            gsi1: {  // list questions by template in order
                partitionKey: "boss_template_id",
                sortKey: "order_key"
            },
        },
    });

    // BossBattleTemplates table - reusable boss battle templates for teachers
    const bossBattleTemplatesTable = new Table(stack, "BossBattleTemplates", {
        fields: {
            boss_template_id: "string",      // PK: UUID
            owner_teacher_id: "string",      // GSI1 PK: for listing by teacher
            is_shared_publicly: "string",    // GSI2 PK: "true" or "false" (string for DynamoDB)
            public_sort: "string",           // GSI2 SK: subject#created_at#id for browsing
        },
        primaryIndex: {
            partitionKey: "boss_template_id"
        },
        globalIndexes: {
            gsi1: {  // list templates by owner teacher
                partitionKey: "owner_teacher_id"
            },
            gsi2: {  // browse public templates by subject and date
                partitionKey: "is_shared_publicly",
                sortKey: "public_sort"
            },
        },
    });

    // RewardTransactions table - immutable ledger for XP/gold/hearts deltas
    const rewardTransactionsTable = new Table(stack, "RewardTransactions", {
        fields: {
            transaction_id: "string",        // PK: deterministic or UUID
            gsi1_pk: "string",               // GSI1 PK: S#<student_id>
            gsi1_sk: "string",               // GSI1 SK: T#<created_at>#TX#<transaction_id>
            gsi2_pk: "string",               // GSI2 PK: C#<class_id>#S#<student_id> (optional)
            gsi2_sk: "string",               // GSI2 SK: T#<created_at>#TX#<transaction_id>
            gsi3_pk: "string",               // GSI3 PK: SRC#<source_type>#<source_id>
            gsi3_sk: "string",               // GSI3 SK: T#<created_at>#S#<student_id>#TX#<transaction_id>
        },
        primaryIndex: {
            partitionKey: "transaction_id"
        },
        globalIndexes: {
            gsi1: {  // student timeline
                partitionKey: "gsi1_pk",
                sortKey: "gsi1_sk"
            },
            gsi2: {  // student per class timeline
                partitionKey: "gsi2_pk",
                sortKey: "gsi2_sk"
            },
            gsi3: {  // source lookup (quest, boss battle, etc.)
                partitionKey: "gsi3_pk",
                sortKey: "gsi3_sk"
            },
        },
    });

    // QuestAnswerAttempts table - individual submission attempts for quest questions
    const questAnswerAttemptsTable = new Table(stack, "QuestAnswerAttempts", {
        fields: {
            quest_attempt_pk: "string",      // PK: QI#<quest_instance_id>#S#<student_id>#Q#<question_id>
            attempt_sk: "string",            // SK: A#<attempt_no_padded>#T#<created_at_iso>
            gsi1_pk: "string",               // GSI1 PK: S#<student_id>#QI#<quest_instance_id>
            gsi1_sk: "string",               // GSI1 SK: T#<created_at>#Q#<question_id>#A#<attempt_no_padded>
            gsi2_pk: "string",               // GSI2 PK: QI#<quest_instance_id>#Q#<question_id>
            gsi2_sk: "string",               // GSI2 SK: T#<created_at>#S#<student_id>#A#<attempt_no_padded>
        },
        primaryIndex: {
            partitionKey: "quest_attempt_pk",
            sortKey: "attempt_sk"
        },
        globalIndexes: {
            gsi1: {  // student attempts within quest instance
                partitionKey: "gsi1_pk",
                sortKey: "gsi1_sk"
            },
            gsi2: {  // question analytics within quest instance
                partitionKey: "gsi2_pk",
                sortKey: "gsi2_sk"
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
        questInstancesTable,
        questQuestionResponsesTable,
        playerStatesTable,
        guildsTable,
        guildMembershipsTable,
        bossQuestionsTable,
        bossBattleTemplatesTable,
        rewardTransactionsTable,
        questAnswerAttemptsTable,
    };
}
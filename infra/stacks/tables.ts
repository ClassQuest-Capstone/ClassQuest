import { StackContext, Table } from "sst/constructs";
import { RemovalPolicy } from "aws-cdk-lib";

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
            status: "string",             // DRAFT | SCHEDULED | ACTIVE | ARCHIVED
            start_date: "string",         // ISO date string
            due_date: "string",           // ISO date string
            requires_manual_approval: "string",  // stored as string for DynamoDB
            schedule_pk: "string",        // GSI_SCHEDULE PK: "SCHEDULED" (sparse - only on SCHEDULED items)
            schedule_sk: "string",        // GSI_SCHEDULE SK: "${start_date}#${quest_instance_id}"
        },
        primaryIndex: { partitionKey: "quest_instance_id" },
        globalIndexes: {
            gsi1: { partitionKey: "class_id" },           // list quests by class
            gsi2: { partitionKey: "quest_template_id" },  // list instances by template (nullable)
            GSI_SCHEDULE: {                               // cron activation query (sparse index)
                partitionKey: "schedule_pk",
                sortKey: "schedule_sk",
            },
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

    // BossBattleInstances table - live boss battle state machine
    const bossBattleInstancesTable = new Table(stack, "BossBattleInstances", {
        fields: {
            boss_instance_id: "string",      // PK: UUID
            class_id: "string",              // GSI1 PK: for listing battles by class
            created_at: "string",            // GSI1 SK & GSI2 SK: ISO timestamp for sorting
            boss_template_id: "string",      // GSI2 PK: for listing battles by template
        },
        primaryIndex: {
            partitionKey: "boss_instance_id"
        },
        globalIndexes: {
            gsi1: {  // list by class
                partitionKey: "class_id",
                sortKey: "created_at"
            },
            gsi2: {  // list by template
                partitionKey: "boss_template_id",
                sortKey: "created_at"
            },
        },
    });

    // BossBattleParticipants table - tracks who joined specific boss battles
    const bossBattleParticipantsTable = new Table(stack, "BossBattleParticipants", {
        fields: {
            boss_instance_id: "string",      // PK: boss battle instance
            student_id: "string",            // SK: student ID
            class_id: "string",              // GSI1 PK & GSI2 PK: for teacher queries by class
            joined_at: "string",             // GSI1 SK: ISO timestamp for ordering
            gsi2_sk: "string",               // GSI2 SK: boss_instance_id#student_id
        },
        primaryIndex: {
            partitionKey: "boss_instance_id",
            sortKey: "student_id"
        },
        globalIndexes: {
            gsi1: {  // list participants by instance (optional convenience)
                partitionKey: "boss_instance_id",
                sortKey: "joined_at"
            },
            gsi2: {  // list participants by class for teacher views
                partitionKey: "class_id",
                sortKey: "gsi2_sk"
            },
        },
    });

    // BossAnswerAttempts table - immutable combat log of boss battle submissions
    const bossAnswerAttemptsTable = new Table(stack, "BossAnswerAttempts", {
        fields: {
            boss_attempt_pk: "string",       // PK: BI#<boss_instance_id>#Q#<question_id>
            attempt_sk: "string",            // SK: T#<answered_at>#S#<student_id>#A#<uuid>
            boss_instance_id: "string",      // GSI1 PK: for listing all attempts in battle
            answered_at: "string",           // GSI1 SK & GSI2 SK: ISO timestamp
            student_id: "string",            // GSI2 PK & GSI3 PK component
            gsi2_sk: "string",               // GSI2 SK: answered_at#boss_instance_id#question_id
            gsi3_pk: "string",               // GSI3 PK: boss_instance_id#student_id
            gsi3_sk: "string",               // GSI3 SK: answered_at#question_id
        },
        primaryIndex: {
            partitionKey: "boss_attempt_pk",
            sortKey: "attempt_sk"
        },
        globalIndexes: {
            gsi1: {  // list all attempts by battle
                partitionKey: "boss_instance_id",
                sortKey: "answered_at"
            },
            gsi2: {  // list all attempts by student
                partitionKey: "student_id",
                sortKey: "gsi2_sk"
            },
            gsi3: {  // list attempts by battle+student (teacher drilldown)
                partitionKey: "gsi3_pk",
                sortKey: "gsi3_sk"
            },
        },
    });

    // BossResults table - immutable post-battle aggregated summaries
    const bossResultsTable = new Table(stack, "BossResults", {
        fields: {
            boss_result_pk: "string",        // PK: BI#<boss_instance_id>
            boss_result_sk: "string",        // SK: STU#<student_id> | GUILD#<guild_id> | META
            student_id: "string",            // GSI1 PK: for student history (student rows only)
            gsi1_sk: "string",               // GSI1 SK: completed_at#boss_instance_id
            class_id: "string",              // GSI2 PK: for class history
            gsi2_sk: "string",               // GSI2 SK: completed_at#boss_instance_id
            completed_at: "string",          // ISO timestamp
        },
        primaryIndex: {
            partitionKey: "boss_result_pk",
            sortKey: "boss_result_sk"
        },
        globalIndexes: {
            gsi1: {  // student battle history
                partitionKey: "student_id",
                sortKey: "gsi1_sk"
            },
            gsi2: {  // class battle history
                partitionKey: "class_id",
                sortKey: "gsi2_sk"
            },
        },
    });

    // BossBattleSnapshots table - immutable participation snapshots
    const bossBattleSnapshotsTable = new Table(stack, "BossBattleSnapshots", {
        fields: {
            snapshot_id: "string",           // PK: ULID/UUID
            boss_instance_id: "string",      // GSI1 PK: for listing snapshots by battle
            created_at: "string",            // GSI1 SK: ISO timestamp
        },
        primaryIndex: {
            partitionKey: "snapshot_id"
        },
        globalIndexes: {
            gsi1: {  // list snapshots by battle (debugging)
                partitionKey: "boss_instance_id",
                sortKey: "created_at"
            },
        },
    });

    // RewardMilestones table - level-based cosmetic rewards that unlock for students
    //
    // Attributes (all stored dynamically; only index keys declared in `fields`):
    //   reward_id               (string)  PK — UUID
    //   class_id                (string)  GSI1 PK
    //   unlock_sort             (string)  GSI1 SK — "ACTIVE#00005#HELMET#reward_id"
    //                                     format guarantees: active-first grouping,
    //                                     correct numeric level sort, type, stable id suffix
    //   created_by_teacher_id   (string)  GSI2 PK
    //   teacher_sort            (string)  GSI2 SK — "class_id#ACTIVE#00005#reward_id"
    //   title                   (string)
    //   description             (string)
    //   unlock_level            (number)
    //   type                    (string)  e.g. "HELMET", "ARMOR_SET"
    //   reward_target_type      (string)  e.g. "AVATAR"
    //   reward_target_id        (string)
    //   image_asset_path        (string)
    //   is_active               (boolean)
    //   is_deleted              (boolean)
    //   created_at              (string)  ISO timestamp
    //   updated_at              (string)  ISO timestamp
    //   deleted_at              (string)  ISO timestamp — optional, set on soft-delete
    //   updated_by_teacher_id   (string)  optional
    //   notes                   (string)  optional
    const rewardMilestonesTable = new Table(stack, "RewardMilestones", {
        fields: {
            reward_id:              "string",  // PK
            class_id:               "string",  // GSI1 PK
            unlock_sort:            "string",  // GSI1 SK: ACTIVE#00005#TYPE#reward_id
            created_by_teacher_id:  "string",  // GSI2 PK
            teacher_sort:           "string",  // GSI2 SK: class_id#ACTIVE#00005#reward_id
        },
        primaryIndex: { partitionKey: "reward_id" },
        globalIndexes: {
            GSI1: {  // rewards by class, ordered by unlock level
                partitionKey: "class_id",
                sortKey: "unlock_sort",
            },
            GSI2: {  // rewards created by a teacher (across classes)
                partitionKey: "created_by_teacher_id",
                sortKey: "teacher_sort",
            },
        },
        cdk: {
            table: {
                pointInTimeRecovery: true,
                removalPolicy: RemovalPolicy.RETAIN,
            },
        },
    });

    // StudentRewardClaims table - per-student claim state for reward milestones
    //
    // Attributes (all stored dynamically; only index keys declared in `fields`):
    //   student_reward_claim_id  (string)  PK — UUID
    //   student_id               (string)  GSI1 PK
    //   claim_sort               (string)  GSI1 SK — "{AVAILABLE|CLAIMED}#{class_id}#{level_5d}#{reward_id}"
    //   reward_id                (string)  GSI2 PK
    //   class_id                 (string)
    //   status                   (string)  AVAILABLE | CLAIMED
    //   unlocked_at_level        (number)
    //   unlocked_at              (string)  ISO timestamp — set when AVAILABLE
    //   claimed_at               (string)  ISO timestamp — set when CLAIMED
    //   reward_target_type       (string)  optional
    //   reward_target_id         (string)  optional
    //   created_at               (string)  ISO timestamp
    //   updated_at               (string)  ISO timestamp
    //   notes                    (string)  optional
    const studentRewardClaimsTable = new Table(stack, "StudentRewardClaims", {
        fields: {
            student_reward_claim_id: "string",  // PK
            student_id:              "string",  // GSI1 PK & GSI2 SK
            claim_sort:              "string",  // GSI1 SK: {status}#{class_id}#{level_5d}#{reward_id}
            reward_id:               "string",  // GSI2 PK
        },
        primaryIndex: { partitionKey: "student_reward_claim_id" },
        globalIndexes: {
            GSI1: {  // list all rewards for one student, sorted by status/class/level
                partitionKey: "student_id",
                sortKey: "claim_sort",
            },
            GSI2: {  // duplicate check: find existing claim for student + reward
                partitionKey: "reward_id",
                sortKey: "student_id",
            },
        },
        cdk: {
            table: {
                pointInTimeRecovery: true,
                removalPolicy: RemovalPolicy.RETAIN,
            },
        },
    });

    // ShopItems table - global shop item definitions (catalogue, not per-student inventory)
    //
    // Attributes (all stored dynamically; only index keys declared in `fields`):
    //   item_pk          (string)  PK — SHOPITEM#{item_id}
    //   item_sk          (string)  SK — always "META"
    //   item_id          (string)  stable slug or UUID (e.g. "hat_iron_01")
    //   name             (string)  display name
    //   description      (string)  flavour text
    //   category         (string)  e.g. "HAT", "ARMOR_SET"
    //   rarity           (string)  COMMON | UNCOMMON | RARE | EPIC | LEGENDARY
    //   gold_cost        (number)  purchase price in gold (0–999 999)
    //   required_level   (number)  minimum player level (0 = unrestricted)
    //   is_cosmetic_only (boolean) true → visual only, no stat effect
    //   sprite_path      (string)  relative asset path
    //   is_active        (boolean) false → hidden from shop
    //   gsi1pk           (string)  GSI1 PK: SHOP#ACTIVE | SHOP#INACTIVE
    //   gsi1sk           (string)  GSI1 SK: CATEGORY#{cat}#LEVEL#{lv_3d}#PRICE#{price_6d}#RARITY#{rarity}#ITEM#{id}
    //   gsi2pk           (string)  GSI2 PK: CATEGORY#{cat}
    //   gsi2sk           (string)  GSI2 SK: LEVEL#{lv_3d}#PRICE#{price_6d}#ITEM#{id}
    //   created_at       (string)  ISO timestamp
    //   updated_at       (string)  ISO timestamp
    const shopItemsTable = new Table(stack, "ShopItems", {
        fields: {
            item_pk: "string",   // PK: SHOPITEM#{item_id}
            item_sk: "string",   // SK: META
            gsi1pk:  "string",   // GSI1 PK: SHOP#ACTIVE | SHOP#INACTIVE
            gsi1sk:  "string",   // GSI1 SK: CATEGORY#...#LEVEL#...#PRICE#...#RARITY#...#ITEM#...
            gsi2pk:  "string",   // GSI2 PK: CATEGORY#{category}
            gsi2sk:  "string",   // GSI2 SK: LEVEL#...#PRICE#...#ITEM#...
        },
        primaryIndex: {
            partitionKey: "item_pk",
            sortKey:      "item_sk",
        },
        globalIndexes: {
            gsi1: {  // active/inactive browse — sorted by category, level, price, rarity
                partitionKey: "gsi1pk",
                sortKey:      "gsi1sk",
            },
            gsi2: {  // category browse regardless of active status (admin / analytics)
                partitionKey: "gsi2pk",
                sortKey:      "gsi2sk",
            },
        },
    });

    // BossBattleQuestionPlans table - deterministic question sequences
    const bossBattleQuestionPlansTable = new Table(stack, "BossBattleQuestionPlans", {
        fields: {
            plan_id: "string",               // PK: ULID/UUID
            boss_instance_id: "string",      // GSI1 PK: for listing plans by battle
            created_at: "string",            // GSI1 SK: ISO timestamp
        },
        primaryIndex: {
            partitionKey: "plan_id"
        },
        globalIndexes: {
            gsi1: {  // list plans by battle (debugging)
                partitionKey: "boss_instance_id",
                sortKey: "created_at"
            },
        },
    });

    // InventoryItems table — student item ownership records
    //
    // PK: STUDENT#{student_id}
    // SK: ITEM#{item_id}
    //
    // GSI1: GSI1PK (CLASS#{class_id}) / GSI1SK (STUDENT#{student_id}#ITEM#{item_id})
    // GSI2: GSI2PK (ITEM#{item_id})   / GSI2SK (CLASS#{class_id}#STUDENT#{student_id})
    const inventoryItemsTable = new Table(stack, "InventoryItems", {
        fields: {
            PK:     "string",   // STUDENT#{student_id}
            SK:     "string",   // ITEM#{item_id}
            GSI1PK: "string",   // CLASS#{class_id}
            GSI1SK: "string",   // STUDENT#{student_id}#ITEM#{item_id}
            GSI2PK: "string",   // ITEM#{item_id}
            GSI2SK: "string",   // CLASS#{class_id}#STUDENT#{student_id}
        },
        primaryIndex: {
            partitionKey: "PK",
            sortKey:      "SK",
        },
        globalIndexes: {
            gsi1: {  // class-level inventory browse
                partitionKey: "GSI1PK",
                sortKey:      "GSI1SK",
            },
            gsi2: {  // item-centric owner lookup
                partitionKey: "GSI2PK",
                sortKey:      "GSI2SK",
            },
        },
    });

    // ShopListings table — controls where/when/how a ShopItem appears in the shop
    //
    // PK: SHOP#GLOBAL | SHOP#CLASS#{class_id}
    // SK: ACTIVEFROM#{available_from}#LISTING#{shop_listing_id}
    //
    // GSI1: GSI1PK (SHOPVIEW#GLOBAL#ACTIVE etc.) / GSI1SK (FROM#...#TO#...#ITEM#...#LISTING#...)
    // GSI2: GSI2PK (ITEM#{item_id})               / GSI2SK (SHOP#{class|GLOBAL}#FROM#...#LISTING#...)
    // GSI3: shop_listing_id                        — direct lookup by listing ID
    const shopListingsTable = new Table(stack, "ShopListings", {
        fields: {
            PK:              "string",   // SHOP#GLOBAL | SHOP#CLASS#{class_id}
            SK:              "string",   // ACTIVEFROM#{available_from}#LISTING#{shop_listing_id}
            GSI1PK:          "string",   // SHOPVIEW#GLOBAL#ACTIVE | SHOPVIEW#CLASS#{class_id}#INACTIVE | ...
            GSI1SK:          "string",   // FROM#...#TO#...#ITEM#...#LISTING#...
            GSI2PK:          "string",   // ITEM#{item_id}
            GSI2SK:          "string",   // SHOP#GLOBAL#FROM#...#LISTING#... | SHOP#CLASS#{class_id}#FROM#...
            shop_listing_id: "string",   // GSI3 PK — direct lookup by listing ID
        },
        primaryIndex: {
            partitionKey: "PK",
            sortKey:      "SK",
        },
        globalIndexes: {
            gsi1: {  // shop bucket view — active/inactive per scope
                partitionKey: "GSI1PK",
                sortKey:      "GSI1SK",
            },
            gsi2: {  // item-centric lookup — all listings for one item
                partitionKey: "GSI2PK",
                sortKey:      "GSI2SK",
            },
            gsi3: {  // direct listing ID lookup (used by get/update/activate/deactivate)
                partitionKey: "shop_listing_id",
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
        bossBattleInstancesTable,
        bossBattleParticipantsTable,
        bossAnswerAttemptsTable,
        bossResultsTable,
        bossBattleSnapshotsTable,
        bossBattleQuestionPlansTable,
        rewardMilestonesTable,
        studentRewardClaimsTable,
        shopItemsTable,
        shopListingsTable,
        inventoryItemsTable,
    };
}
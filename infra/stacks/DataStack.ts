import { StackContext } from "sst/constructs";
import { createTables } from "./tables";

/**
 * DataStack - Contains all DynamoDB tables
 * Exports table names and ARNs for use by other stacks
 */
export function DataStack(ctx: StackContext) {
    const { stack } = ctx;

    // Create all tables
    const tables = createTables(ctx);

    // Export table names and ARNs for cross-stack references
    stack.addOutputs({
        UsersTableName: tables.usersTable.tableName,
        UsersTableArn: tables.usersTable.tableArn,
        TeacherProfilesTableName: tables.teacherProfilesTable.tableName,
        TeacherProfilesTableArn: tables.teacherProfilesTable.tableArn,
        StudentProfilesTableName: tables.studentProfilesTable.tableName,
        StudentProfilesTableArn: tables.studentProfilesTable.tableArn,
        SchoolsTableName: tables.schoolsTable.tableName,
        SchoolsTableArn: tables.schoolsTable.tableArn,
        ClassesTableName: tables.classesTable.tableName,
        ClassesTableArn: tables.classesTable.tableArn,
        ClassEnrollmentsTableName: tables.classEnrollmentsTable.tableName,
        ClassEnrollmentsTableArn: tables.classEnrollmentsTable.tableArn,
        QuestTemplatesTableName: tables.questTemplatesTable.tableName,
        QuestTemplatesTableArn: tables.questTemplatesTable.tableArn,
        QuestQuestionsTableName: tables.questQuestionsTable.tableName,
        QuestQuestionsTableArn: tables.questQuestionsTable.tableArn,
        QuestInstancesTableName: tables.questInstancesTable.tableName,
        QuestInstancesTableArn: tables.questInstancesTable.tableArn,
        QuestQuestionResponsesTableName: tables.questQuestionResponsesTable.tableName,
        QuestQuestionResponsesTableArn: tables.questQuestionResponsesTable.tableArn,
        PlayerStatesTableName: tables.playerStatesTable.tableName,
        PlayerStatesTableArn: tables.playerStatesTable.tableArn,
        GuildsTableName: tables.guildsTable.tableName,
        GuildsTableArn: tables.guildsTable.tableArn,
        GuildMembershipsTableName: tables.guildMembershipsTable.tableName,
        GuildMembershipsTableArn: tables.guildMembershipsTable.tableArn,
        BossQuestionsTableName: tables.bossQuestionsTable.tableName,
        BossQuestionsTableArn: tables.bossQuestionsTable.tableArn,
        BossBattleTemplatesTableName: tables.bossBattleTemplatesTable.tableName,
        BossBattleTemplatesTableArn: tables.bossBattleTemplatesTable.tableArn,
    });

    return {
        tables,
        // Return props for cross-stack references
        tableNames: {
            usersTable: tables.usersTable.tableName,
            teacherProfilesTable: tables.teacherProfilesTable.tableName,
            studentProfilesTable: tables.studentProfilesTable.tableName,
            schoolsTable: tables.schoolsTable.tableName,
            classesTable: tables.classesTable.tableName,
            classEnrollmentsTable: tables.classEnrollmentsTable.tableName,
            questTemplatesTable: tables.questTemplatesTable.tableName,
            questQuestionsTable: tables.questQuestionsTable.tableName,
            questInstancesTable: tables.questInstancesTable.tableName,
            questQuestionResponsesTable: tables.questQuestionResponsesTable.tableName,
            playerStatesTable: tables.playerStatesTable.tableName,
            guildsTable: tables.guildsTable.tableName,
            guildMembershipsTable: tables.guildMembershipsTable.tableName,
            bossQuestionsTable: tables.bossQuestionsTable.tableName,
            bossBattleTemplatesTable: tables.bossBattleTemplatesTable.tableName,
        },
        tableArns: {
            usersTable: tables.usersTable.tableArn,
            teacherProfilesTable: tables.teacherProfilesTable.tableArn,
            studentProfilesTable: tables.studentProfilesTable.tableArn,
            schoolsTable: tables.schoolsTable.tableArn,
            classesTable: tables.classesTable.tableArn,
            classEnrollmentsTable: tables.classEnrollmentsTable.tableArn,
            questTemplatesTable: tables.questTemplatesTable.tableArn,
            questQuestionsTable: tables.questQuestionsTable.tableArn,
            questInstancesTable: tables.questInstancesTable.tableArn,
            questQuestionResponsesTable: tables.questQuestionResponsesTable.tableArn,
            playerStatesTable: tables.playerStatesTable.tableArn,
            guildsTable: tables.guildsTable.tableArn,
            guildMembershipsTable: tables.guildMembershipsTable.tableArn,
            bossQuestionsTable: tables.bossQuestionsTable.tableArn,
            bossBattleTemplatesTable: tables.bossBattleTemplatesTable.tableArn,
        },
    };
}

/**
 * Repository layer for BossBattleQuestionPlans
 * Includes deterministic plan generation logic
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import {
    BossBattleQuestionPlan,
    BossBattleQuestionPlanGlobal,
    BossBattleQuestionPlanPerGuild,
    ModeType,
    QuestionSelectionMode,
    CreateQuestionPlanInput,
} from "./types.js";
import { seededShuffle, deriveGuildSeed } from "./seededShuffle.js";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.BOSS_BATTLE_QUESTION_PLANS_TABLE_NAME!;
const BOSS_INSTANCES_TABLE = process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME!;
const BOSS_SNAPSHOTS_TABLE = process.env.BOSS_BATTLE_SNAPSHOTS_TABLE_NAME!;
const BOSS_QUESTIONS_TABLE = process.env.BOSS_QUESTIONS_TABLE_NAME!;

/**
 * Create question plan for instance
 * Generates deterministic question sequence(s) at countdown start
 */
export async function createQuestionPlanForInstance(
    input: CreateQuestionPlanInput
): Promise<BossBattleQuestionPlan> {
    const { boss_instance_id, created_by_teacher_id } = input;

    // Step 1: Load BossBattleInstance
    const instanceResult = await ddb.send(
        new GetCommand({
            TableName: BOSS_INSTANCES_TABLE,
            Key: { boss_instance_id },
        })
    );

    if (!instanceResult.Item) {
        throw new Error(`BossBattleInstance ${boss_instance_id} not found`);
    }

    const instance = instanceResult.Item;

    // Guard: require status == LOBBY or COUNTDOWN
    if (instance.status !== "LOBBY" && instance.status !== "COUNTDOWN") {
        throw new Error(
            `Cannot create plan: battle status is ${instance.status}, must be LOBBY or COUNTDOWN`
        );
    }

    const modeType = instance.mode_type as ModeType;
    const questionSelectionMode = instance.question_selection_mode as QuestionSelectionMode;
    const bossTemplateId = instance.boss_template_id;
    const classId = instance.class_id;

    // Step 2: Load BossQuestions for template
    const questionsResult = await ddb.send(
        new QueryCommand({
            TableName: BOSS_QUESTIONS_TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "boss_template_id = :boss_template_id",
            ExpressionAttributeValues: {
                ":boss_template_id": bossTemplateId,
            },
        })
    );

    const questions = questionsResult.Items || [];
    if (questions.length === 0) {
        throw new Error(`No questions found for boss template ${bossTemplateId}`);
    }

    // Sort by order_key (zero-padded string like "0001")
    const sortedQuestions = questions.sort((a, b) =>
        a.order_key.localeCompare(b.order_key)
    );
    const sortedQuestionIds = sortedQuestions.map((q) => q.question_id);

    // Generate seed for determinism
    const seed = randomUUID();
    const createdAt = new Date().toISOString();
    const planId = randomUUID();

    // Step 3: Generate plan based on mode
    if (modeType === "RANDOMIZED_PER_GUILD") {
        // Load participants snapshot to get guild ids
        if (!instance.participants_snapshot_id) {
            throw new Error(
                "Cannot create per-guild plan: no participants snapshot exists"
            );
        }

        const snapshotResult = await ddb.send(
            new GetCommand({
                TableName: BOSS_SNAPSHOTS_TABLE,
                Key: { snapshot_id: instance.participants_snapshot_id },
            })
        );

        if (!snapshotResult.Item) {
            throw new Error(
                `Participants snapshot ${instance.participants_snapshot_id} not found`
            );
        }

        const snapshot = snapshotResult.Item;
        const guildIds = Object.keys(snapshot.guild_counts || {});

        if (guildIds.length === 0) {
            throw new Error("No guilds found in participants snapshot");
        }

        // Build per-guild plan
        const guildQuestionIds: Record<string, string[]> = {};
        const guildQuestionCount: Record<string, number> = {};

        for (const guildId of guildIds) {
            if (questionSelectionMode === "ORDERED") {
                // Same ordered list for all guilds (or optional: rotate start)
                guildQuestionIds[guildId] = [...sortedQuestionIds];
            } else {
                // RANDOM_NO_REPEAT: derive guild-specific seed
                const guildSeed = deriveGuildSeed(seed, guildId);
                guildQuestionIds[guildId] = seededShuffle(sortedQuestionIds, guildSeed);
            }
            guildQuestionCount[guildId] = guildQuestionIds[guildId].length;
        }

        const plan: BossBattleQuestionPlanPerGuild = {
            plan_id: planId,
            boss_instance_id,
            class_id: classId,
            boss_template_id: bossTemplateId,
            mode_type: "RANDOMIZED_PER_GUILD",
            question_selection_mode: questionSelectionMode,
            created_by_teacher_id,
            created_at: createdAt,
            version: 1,
            guild_question_ids: guildQuestionIds,
            guild_question_count: guildQuestionCount,
            seed,
        };

        // Write plan
        await ddb.send(
            new PutCommand({
                TableName: TABLE,
                Item: plan,
            })
        );

        // Update BossBattleInstances
        await updateInstanceWithPlan(boss_instance_id, planId, guildIds, true);

        return plan;
    } else {
        // SIMULTANEOUS_ALL or TURN_BASED_GUILD: global plan
        let questionIds: string[];
        if (questionSelectionMode === "ORDERED") {
            questionIds = sortedQuestionIds;
        } else {
            // RANDOM_NO_REPEAT: seeded shuffle
            questionIds = seededShuffle(sortedQuestionIds, seed);
        }

        const plan: BossBattleQuestionPlanGlobal = {
            plan_id: planId,
            boss_instance_id,
            class_id: classId,
            boss_template_id: bossTemplateId,
            mode_type: modeType,
            question_selection_mode: questionSelectionMode,
            created_by_teacher_id,
            created_at: createdAt,
            version: 1,
            question_ids: questionIds,
            question_count: questionIds.length,
            seed,
        };

        // Write plan
        await ddb.send(
            new PutCommand({
                TableName: TABLE,
                Item: plan,
            })
        );

        // Update BossBattleInstances
        await updateInstanceWithPlan(boss_instance_id, planId, [], false);

        return plan;
    }
}

/**
 * Update BossBattleInstances with plan references and initialize indexes
 */
async function updateInstanceWithPlan(
    bossInstanceId: string,
    planId: string,
    guildIds: string[],
    isPerGuild: boolean
): Promise<void> {
    const now = new Date().toISOString();

    if (isPerGuild) {
        // Initialize per_guild_question_index map
        const perGuildQuestionIndex: Record<string, number> = {};
        for (const guildId of guildIds) {
            perGuildQuestionIndex[guildId] = 0;
        }

        try {
            await ddb.send(
                new UpdateCommand({
                    TableName: BOSS_INSTANCES_TABLE,
                    Key: { boss_instance_id: bossInstanceId },
                    UpdateExpression:
                        "SET question_plan_id = :plan_id, guild_question_plan_id = :plan_id, current_question_index = :zero, per_guild_question_index = :per_guild_index, updated_at = :now",
                    ConditionExpression: "attribute_not_exists(question_plan_id)",
                    ExpressionAttributeValues: {
                        ":plan_id": planId,
                        ":zero": 0,
                        ":per_guild_index": perGuildQuestionIndex,
                        ":now": now,
                    },
                })
            );
        } catch (error: any) {
            if (error.name === "ConditionalCheckFailedException") {
                throw new Error("Question plan already exists for this battle");
            }
            throw error;
        }
    } else {
        // Global plan
        try {
            await ddb.send(
                new UpdateCommand({
                    TableName: BOSS_INSTANCES_TABLE,
                    Key: { boss_instance_id: bossInstanceId },
                    UpdateExpression:
                        "SET question_plan_id = :plan_id, current_question_index = :zero, updated_at = :now",
                    ConditionExpression: "attribute_not_exists(question_plan_id)",
                    ExpressionAttributeValues: {
                        ":plan_id": planId,
                        ":zero": 0,
                        ":now": now,
                    },
                })
            );
        } catch (error: any) {
            if (error.name === "ConditionalCheckFailedException") {
                throw new Error("Question plan already exists for this battle");
            }
            throw error;
        }
    }
}

/**
 * Get question plan by ID
 */
export async function getQuestionPlan(
    planId: string
): Promise<BossBattleQuestionPlan | null> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: { plan_id: planId },
        })
    );

    return (result.Item as BossBattleQuestionPlan) || null;
}

/**
 * List plans by battle instance (GSI1) - debugging
 */
export async function listPlansByInstance(
    bossInstanceId: string,
    options?: {
        limit?: number;
        nextToken?: string;
    }
): Promise<{ items: BossBattleQuestionPlan[]; nextToken?: string }> {
    const params: any = {
        TableName: TABLE,
        IndexName: "gsi1",
        KeyConditionExpression: "boss_instance_id = :boss_instance_id",
        ExpressionAttributeValues: {
            ":boss_instance_id": bossInstanceId,
        },
        Limit: options?.limit || 50,
    };

    if (options?.nextToken) {
        params.ExclusiveStartKey = JSON.parse(
            Buffer.from(options.nextToken, "base64").toString("utf-8")
        );
    }

    const result = await ddb.send(new QueryCommand(params));

    const nextToken = result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
        : undefined;

    return {
        items: (result.Items as BossBattleQuestionPlan[]) || [],
        nextToken,
    };
}

/**
 * Repository layer for BossResults
 * Includes aggregation logic
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    QueryCommand,
    GetCommand,
} from "@aws-sdk/lib-dynamodb";
import {
    BossResultStudentRow,
    BossResultGuildRow,
    BossResultMetaRow,
    BattleOutcome,
    FailReason,
    ParticipationState,
} from "./types.js";
import {
    buildBossResultPk,
    buildStudentResultSk,
    buildGuildResultSk,
    buildMetaResultSk,
    buildGsi1Sk,
    buildGsi2Sk,
    isStudentRow,
    isGuildRow,
} from "./keys.js";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.BOSS_RESULTS_TABLE_NAME!;
const BOSS_INSTANCES_TABLE = process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME!;
const BOSS_PARTICIPANTS_TABLE = process.env.BOSS_BATTLE_PARTICIPANTS_TABLE_NAME!;
const BOSS_ATTEMPTS_TABLE = process.env.BOSS_ANSWER_ATTEMPTS_TABLE_NAME!;
const REWARD_TRANSACTIONS_TABLE = process.env.REWARD_TRANSACTIONS_TABLE_NAME!;

/**
 * Check if results already exist (idempotency check)
 */
export async function resultsExist(bossInstanceId: string): Promise<boolean> {
    const result = await ddb.send(
        new GetCommand({
            TableName: TABLE,
            Key: {
                boss_result_pk: buildBossResultPk(bossInstanceId),
                boss_result_sk: buildMetaResultSk(),
            },
        })
    );
    return !!result.Item;
}

/**
 * Write meta row for idempotency
 */
async function writeMetaRow(
    bossInstanceId: string,
    aggregatedBy: string
): Promise<void> {
    const meta: BossResultMetaRow = {
        boss_result_pk: buildBossResultPk(bossInstanceId),
        boss_result_sk: buildMetaResultSk(),
        boss_instance_id: bossInstanceId,
        created_at: new Date().toISOString(),
        aggregated_by: aggregatedBy,
    };

    await ddb.send(
        new PutCommand({
            TableName: TABLE,
            Item: meta,
            ConditionExpression: "attribute_not_exists(boss_result_pk)",
        })
    );
}

/**
 * Compute and write boss results
 * Idempotent - can be re-run safely
 */
export async function computeAndWriteBossResults(
    bossInstanceId: string,
    aggregatedBy: string = "system"
): Promise<{ success: boolean; message: string }> {
    // Step 1: Check idempotency
    const exists = await resultsExist(bossInstanceId);
    if (exists) {
        return {
            success: false,
            message: "Results already exist for this battle",
        };
    }

    // Step 2: Load BossBattleInstance
    const instanceResult = await ddb.send(
        new GetCommand({
            TableName: BOSS_INSTANCES_TABLE,
            Key: { boss_instance_id: bossInstanceId },
        })
    );

    if (!instanceResult.Item) {
        throw new Error(`BossBattleInstance ${bossInstanceId} not found`);
    }

    const instance = instanceResult.Item;

    // Guard: must be COMPLETED or ABORTED
    if (instance.status !== "COMPLETED" && instance.status !== "ABORTED") {
        throw new Error(
            `Battle status is ${instance.status}, must be COMPLETED or ABORTED`
        );
    }

    const outcome: BattleOutcome = instance.outcome || "ABORTED";
    const completedAt = instance.completed_at || new Date().toISOString();
    const failReason: FailReason | undefined = instance.fail_reason;

    // Step 3: Load participants
    const participantsResult = await ddb.send(
        new QueryCommand({
            TableName: BOSS_PARTICIPANTS_TABLE,
            KeyConditionExpression: "boss_instance_id = :boss_instance_id",
            ExpressionAttributeValues: {
                ":boss_instance_id": bossInstanceId,
            },
        })
    );

    const participants = participantsResult.Items || [];

    // Step 4: Query all attempts for this battle
    const attemptsResult = await ddb.send(
        new QueryCommand({
            TableName: BOSS_ATTEMPTS_TABLE,
            IndexName: "gsi1",
            KeyConditionExpression: "boss_instance_id = :boss_instance_id",
            ExpressionAttributeValues: {
                ":boss_instance_id": bossInstanceId,
            },
        })
    );

    const attempts = attemptsResult.Items || [];

    // Step 5: Aggregate by student and guild
    const studentAggregates = new Map<
        string,
        {
            student_id: string;
            guild_id: string;
            total_correct: number;
            total_incorrect: number;
            total_attempts: number;
            total_damage_to_boss: number;
            hearts_lost: number;
            last_answered_at?: string;
        }
    >();

    const guildAggregates = new Map<
        string,
        {
            guild_id: string;
            guild_total_correct: number;
            guild_total_incorrect: number;
            guild_total_attempts: number;
            guild_total_damage_to_boss: number;
            guild_total_hearts_lost: number;
            guild_members_joined: number;
            guild_members_downed: number;
        }
    >();

    // Initialize from participants
    for (const participant of participants) {
        if (participant.state === "JOINED" || participant.state === "SPECTATE") {
            studentAggregates.set(participant.student_id, {
                student_id: participant.student_id,
                guild_id: participant.guild_id,
                total_correct: 0,
                total_incorrect: 0,
                total_attempts: 0,
                total_damage_to_boss: 0,
                hearts_lost: 0,
            });

            if (!guildAggregates.has(participant.guild_id)) {
                guildAggregates.set(participant.guild_id, {
                    guild_id: participant.guild_id,
                    guild_total_correct: 0,
                    guild_total_incorrect: 0,
                    guild_total_attempts: 0,
                    guild_total_damage_to_boss: 0,
                    guild_total_hearts_lost: 0,
                    guild_members_joined: 0,
                    guild_members_downed: 0,
                });
            }
        }
    }

    // Count guild members
    for (const participant of participants) {
        const guildAgg = guildAggregates.get(participant.guild_id);
        if (guildAgg) {
            if (participant.state === "JOINED" || participant.state === "SPECTATE") {
                guildAgg.guild_members_joined++;
            }
            if (participant.is_downed) {
                guildAgg.guild_members_downed++;
            }
        }
    }

    // Aggregate attempts
    for (const attempt of attempts) {
        const studentAgg = studentAggregates.get(attempt.student_id);
        if (!studentAgg) continue;

        studentAgg.total_attempts++;
        if (attempt.is_correct) {
            studentAgg.total_correct++;
            studentAgg.total_damage_to_boss += attempt.damage_to_boss || 0;
        } else {
            studentAgg.total_incorrect++;
        }

        const heartsLost = Math.abs(attempt.hearts_delta_student || 0);
        studentAgg.hearts_lost += heartsLost;

        if (
            !studentAgg.last_answered_at ||
            attempt.answered_at > studentAgg.last_answered_at
        ) {
            studentAgg.last_answered_at = attempt.answered_at;
        }

        // Aggregate guild totals
        const guildAgg = guildAggregates.get(studentAgg.guild_id);
        if (guildAgg) {
            guildAgg.guild_total_attempts++;
            if (attempt.is_correct) {
                guildAgg.guild_total_correct++;
                guildAgg.guild_total_damage_to_boss += attempt.damage_to_boss || 0;
            } else {
                guildAgg.guild_total_incorrect++;
            }
            guildAgg.guild_total_hearts_lost += heartsLost;
        }
    }

    // Step 6: Query rewards from RewardTransactions
    // NOTE: This is a simplified version - actual implementation should query GSI3
    const rewardsResult = await ddb.send(
        new QueryCommand({
            TableName: REWARD_TRANSACTIONS_TABLE,
            IndexName: "gsi3",
            KeyConditionExpression: "gsi3_pk = :source_pk",
            ExpressionAttributeValues: {
                ":source_pk": `SRC#BOSS_BATTLE#${bossInstanceId}`,
            },
        })
    );

    const rewards = rewardsResult.Items || [];

    // Map rewards by student
    const studentRewards = new Map<
        string,
        { xp: number; gold: number; reward_txn_ids: string[] }
    >();

    for (const reward of rewards) {
        if (!reward.student_id) continue;
        if (!studentRewards.has(reward.student_id)) {
            studentRewards.set(reward.student_id, {
                xp: 0,
                gold: 0,
                reward_txn_ids: [],
            });
        }
        const studentReward = studentRewards.get(reward.student_id)!;
        studentReward.xp += reward.xp_delta || 0;
        studentReward.gold += reward.gold_delta || 0;
        studentReward.reward_txn_ids.push(reward.transaction_id);
    }

    // Step 7: Write META row first (idempotency guard)
    try {
        await writeMetaRow(bossInstanceId, aggregatedBy);
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                success: false,
                message: "Results were written by another process",
            };
        }
        throw error;
    }

    // Step 8: Write student rows
    for (const [studentId, agg] of studentAggregates) {
        const participant = participants.find((p) => p.student_id === studentId);
        let participationState: ParticipationState = "JOINED";
        if (participant) {
            if (participant.is_downed) {
                participationState = "DOWNED";
            } else {
                participationState = participant.state as ParticipationState;
            }
        }

        const reward = studentRewards.get(studentId) || {
            xp: 0,
            gold: 0,
            reward_txn_ids: [],
        };

        const studentRow: BossResultStudentRow = {
            boss_result_pk: buildBossResultPk(bossInstanceId),
            boss_result_sk: buildStudentResultSk(studentId),
            boss_instance_id: bossInstanceId,
            class_id: instance.class_id,
            boss_template_id: instance.boss_template_id,
            outcome,
            completed_at: completedAt,
            created_at: new Date().toISOString(),
            student_id: studentId,
            guild_id: agg.guild_id,
            total_correct: agg.total_correct,
            total_incorrect: agg.total_incorrect,
            total_attempts: agg.total_attempts,
            total_damage_to_boss: agg.total_damage_to_boss,
            hearts_lost: agg.hearts_lost,
            xp_awarded: reward.xp,
            gold_awarded: reward.gold,
            participation_state: participationState,
            last_answered_at: agg.last_answered_at,
            gsi1_sk: buildGsi1Sk(completedAt, bossInstanceId),
            gsi2_sk: buildGsi2Sk(completedAt, bossInstanceId),
            fail_reason: failReason,
            reward_txn_ids: reward.reward_txn_ids,
        };

        await ddb.send(
            new PutCommand({
                TableName: TABLE,
                Item: studentRow,
            })
        );
    }

    // Step 9: Write guild rows
    for (const [guildId, agg] of guildAggregates) {
        // Calculate guild totals for rewards
        let guildXpTotal = 0;
        let guildGoldTotal = 0;
        for (const [studentId, studentAgg] of studentAggregates) {
            if (studentAgg.guild_id === guildId) {
                const reward = studentRewards.get(studentId);
                if (reward) {
                    guildXpTotal += reward.xp;
                    guildGoldTotal += reward.gold;
                }
            }
        }

        const guildRow: BossResultGuildRow = {
            boss_result_pk: buildBossResultPk(bossInstanceId),
            boss_result_sk: buildGuildResultSk(guildId),
            boss_instance_id: bossInstanceId,
            class_id: instance.class_id,
            boss_template_id: instance.boss_template_id,
            outcome,
            completed_at: completedAt,
            created_at: new Date().toISOString(),
            guild_id: guildId,
            guild_total_correct: agg.guild_total_correct,
            guild_total_incorrect: agg.guild_total_incorrect,
            guild_total_attempts: agg.guild_total_attempts,
            guild_total_damage_to_boss: agg.guild_total_damage_to_boss,
            guild_total_hearts_lost: agg.guild_total_hearts_lost,
            guild_xp_awarded_total: guildXpTotal,
            guild_gold_awarded_total: guildGoldTotal,
            guild_members_joined: agg.guild_members_joined,
            guild_members_downed: agg.guild_members_downed,
            gsi2_sk: buildGsi2Sk(completedAt, bossInstanceId),
            fail_reason: failReason,
        };

        await ddb.send(
            new PutCommand({
                TableName: TABLE,
                Item: guildRow,
            })
        );
    }

    return {
        success: true,
        message: "Boss results computed and written successfully",
    };
}

/**
 * Get all results for a battle
 */
export async function getBossResults(bossInstanceId: string) {
    const result = await ddb.send(
        new QueryCommand({
            TableName: TABLE,
            KeyConditionExpression: "boss_result_pk = :pk",
            ExpressionAttributeValues: {
                ":pk": buildBossResultPk(bossInstanceId),
            },
        })
    );

    const items = result.Items || [];

    const guildResults: BossResultGuildRow[] = [];
    const studentResults: BossResultStudentRow[] = [];
    let outcome: BattleOutcome = "ABORTED";
    let completedAt = "";
    let failReason: FailReason | undefined;

    for (const item of items) {
        if (isGuildRow(item.boss_result_sk)) {
            guildResults.push(item as BossResultGuildRow);
            outcome = item.outcome;
            completedAt = item.completed_at;
            failReason = item.fail_reason;
        } else if (isStudentRow(item.boss_result_sk)) {
            studentResults.push(item as BossResultStudentRow);
            outcome = item.outcome;
            completedAt = item.completed_at;
            failReason = item.fail_reason;
        }
    }

    return {
        outcome,
        completed_at: completedAt,
        fail_reason: failReason,
        guild_results: guildResults,
        student_results: studentResults,
    };
}

/**
 * List student's boss battle history (GSI1)
 */
export async function listStudentBossResults(
    studentId: string,
    options?: {
        limit?: number;
        nextToken?: string;
    }
) {
    const params: any = {
        TableName: TABLE,
        IndexName: "gsi1",
        KeyConditionExpression: "student_id = :student_id",
        ExpressionAttributeValues: {
            ":student_id": studentId,
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
        items: (result.Items as BossResultStudentRow[]) || [],
        nextToken,
    };
}

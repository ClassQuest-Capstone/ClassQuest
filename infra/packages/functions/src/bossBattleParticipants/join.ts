/**
 * POST /bossBattleInstances/{boss_instance_id}/participants/join
 * Join a boss battle
 */

import { upsertParticipantJoin, setParticipantSpectate } from "./repo.js";
import { validateJoinInput } from "./validation.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const BOSS_INSTANCES_TABLE = process.env.BOSS_BATTLE_INSTANCES_TABLE_NAME!;

export const handler = async (event: any) => {
    try {
        const bossInstanceId = event.pathParameters?.boss_instance_id;
        if (!bossInstanceId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "boss_instance_id is required" }),
            };
        }

        // Extract student_id from JWT claims
        const studentId = event.requestContext?.authorizer?.jwt?.claims?.sub;
        if (!studentId) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized" }),
            };
        }

        // Parse body
        const body = JSON.parse(event.body || "{}");
        const { guild_id } = body;

        if (!guild_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "guild_id is required in body" }),
            };
        }

        // Fetch BossBattleInstances record to check status and late_join_policy
        const instanceResult = await ddb.send(
            new GetCommand({
                TableName: BOSS_INSTANCES_TABLE,
                Key: { boss_instance_id: bossInstanceId },
            })
        );

        if (!instanceResult.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    error: "Boss battle instance not found",
                }),
            };
        }

        const instance = instanceResult.Item;
        const { status, late_join_policy, class_id } = instance;

        // Authorization: student must be enrolled in the class
        // (Placeholder - in production, verify class enrollment)
        // For now, we'll trust that the student is authorized

        // Joining rules
        if (status === "LOBBY") {
            // Allow JOINED
            const validation = validateJoinInput({
                boss_instance_id: bossInstanceId,
                student_id: studentId,
                class_id,
                guild_id,
            });

            if (!validation.valid) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: validation.error }),
                };
            }

            const participant = await upsertParticipantJoin({
                boss_instance_id: bossInstanceId,
                student_id: studentId,
                class_id,
                guild_id,
            });

            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: "Successfully joined the battle",
                    state: participant.state,
                }),
            };
        } else if (
            status === "COUNTDOWN" ||
            status === "QUESTION_ACTIVE" ||
            status === "RESOLVING" ||
            status === "INTERMISSION"
        ) {
            // Check late_join_policy
            if (late_join_policy === "ALLOW_SPECTATE") {
                // Set state=SPECTATE
                const validation = validateJoinInput({
                    boss_instance_id: bossInstanceId,
                    student_id: studentId,
                    class_id,
                    guild_id,
                });

                if (!validation.valid) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: validation.error }),
                    };
                }

                // Create participant record with SPECTATE state
                // We'll first try to upsert, then immediately set to SPECTATE
                const participant = await upsertParticipantJoin({
                    boss_instance_id: bossInstanceId,
                    student_id: studentId,
                    class_id,
                    guild_id,
                });

                // Now set to SPECTATE
                await setParticipantSpectate(bossInstanceId, studentId);

                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        message:
                            "Battle already started. You have been added as a spectator.",
                        state: "SPECTATE",
                    }),
                };
            } else {
                // Reject
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        error: "Cannot join battle after countdown has started",
                    }),
                };
            }
        } else if (status === "COMPLETED" || status === "ABORTED") {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: "Cannot join a completed or aborted battle",
                }),
            };
        } else {
            // DRAFT or other status
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: `Cannot join battle in ${status} status`,
                }),
            };
        }
    } catch (error: any) {
        console.error("Error joining battle:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

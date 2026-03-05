/**
 * activateScheduledQuests.ts
 *
 * Scheduled Lambda — runs daily at 00:01 America/Regina (06:01 UTC).
 * America/Regina is permanently UTC-6 (no DST).
 *
 * PURPOSE
 * -------
 * Finds every QuestInstance whose status is "SCHEDULED" and whose
 * start_date is on or before today, then atomically transitions it to
 * "ACTIVE".
 *
 * GSI QUERY
 * ---------
 * The QuestInstances table has a sparse GSI called GSI_SCHEDULE:
 *   PK  schedule_pk = "SCHEDULED"   (only present when status = "SCHEDULED")
 *   SK  schedule_sk = "${start_date}#${quest_instance_id}"
 *
 * Because schedule_sk is prefixed with start_date, the range query
 *   schedule_sk <= "${nowISO}#~"
 * retrieves only items whose start_date sorts ≤ now.
 * ("~" is ASCII 126, which sorts after all alphanumeric characters and
 *  after "Z", so it acts as a safe upper-bound suffix for any uuid.)
 *
 * IDEMPOTENCY
 * -----------
 * Each UpdateItem uses a ConditionExpression:
 *   status = "SCHEDULED"  AND  start_date <= :nowISO
 * A second run within the same minute safely skips already-activated items
 * (ConditionalCheckFailedException is caught and counted as "skipped").
 *
 * DRY RUN
 * -------
 * Set env var DRY_RUN=true to log what would be activated without writing.
 *
 * LOCAL TESTING
 * -------------
 *   export QUEST_INSTANCES_TABLE_NAME=classquest-dev-QuestInstances
 *   export AWS_REGION=ca-central-1
 *   export DRY_RUN=true
 *   node --import tsx infra/packages/functions/src/questInstances/activateScheduledQuests.ts
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    QueryCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.QUEST_INSTANCES_TABLE_NAME!;
const DRY_RUN = process.env.DRY_RUN === "true";

if (!TABLE) {
    throw new Error("Missing QUEST_INSTANCES_TABLE_NAME environment variable");
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (_event: unknown): Promise<void> => {
    const nowISO = new Date().toISOString();

    // Sort-key upper bound: "~" (ASCII 126) sorts after all UUIDs
    // so this range catches every instance whose start_date <= today
    const boundary = `${nowISO}#~`;

    console.log(JSON.stringify({ msg: "activateScheduledQuests start", nowISO, DRY_RUN }));

    let queried = 0;
    let activated = 0;
    let skipped = 0;
    let lastKey: Record<string, unknown> | undefined;

    do {
        const result = await ddb.send(
            new QueryCommand({
                TableName: TABLE,
                IndexName: "GSI_SCHEDULE",
                KeyConditionExpression:
                    "schedule_pk = :spk AND schedule_sk <= :boundary",
                ExpressionAttributeValues: {
                    ":spk": "SCHEDULED",
                    ":boundary": boundary,
                },
                ExclusiveStartKey: lastKey,
            })
        );

        const items = (result.Items ?? []) as Array<{
            quest_instance_id: string;
            start_date?: string;
        }>;
        queried += items.length;
        lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;

        for (const item of items) {
            const { quest_instance_id, start_date } = item;

            if (DRY_RUN) {
                console.log(
                    JSON.stringify({ msg: "DRY_RUN would activate", quest_instance_id, start_date })
                );
                activated++;
                continue;
            }

            try {
                await ddb.send(
                    new UpdateCommand({
                        TableName: TABLE,
                        Key: { quest_instance_id },
                        // Activate the item and strip the GSI keys so it leaves the index
                        UpdateExpression:
                            "SET #status = :active, #activated_at = :now, #updated_at = :now " +
                            "REMOVE #schedule_pk, #schedule_sk",
                        // Guard against duplicate runs or start_date moving forward
                        ConditionExpression:
                            "#status = :scheduled AND #start_date <= :nowISO",
                        ExpressionAttributeNames: {
                            "#status":       "status",
                            "#activated_at": "activated_at",
                            "#updated_at":   "updated_at",
                            "#schedule_pk":  "schedule_pk",
                            "#schedule_sk":  "schedule_sk",
                            "#start_date":   "start_date",
                        },
                        ExpressionAttributeValues: {
                            ":active":    "ACTIVE",
                            ":scheduled": "SCHEDULED",
                            ":now":       nowISO,
                            ":nowISO":    nowISO,
                        },
                    })
                );
                activated++;
                console.log(JSON.stringify({ msg: "activated", quest_instance_id }));
            } catch (err: unknown) {
                const error = err as { name?: string; message?: string };
                if (error.name === "ConditionalCheckFailedException") {
                    // Already activated by a concurrent run, or start_date was pushed forward
                    skipped++;
                    console.log(
                        JSON.stringify({ msg: "skipped (conditional failed)", quest_instance_id })
                    );
                } else {
                    console.error(
                        JSON.stringify({ msg: "error", quest_instance_id, error: error.message })
                    );
                    throw err;
                }
            }
        }
    } while (lastKey);

    console.log(
        JSON.stringify({ msg: "activateScheduledQuests done", queried, activated, skipped })
    );
};

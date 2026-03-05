import { Cron, StackContext } from "sst/constructs";
import * as iam from "aws-cdk-lib/aws-iam";

type AutomationStackProps = {
    tableNames: {
        questInstancesTable: string;
    };
    tableArns: {
        questInstancesTable: string;
    };
};

/**
 * AutomationStack - Scheduled background jobs
 *
 * Currently contains one cron:
 *   activateScheduledQuests — runs daily at 00:01 America/Regina (06:01 UTC).
 *   America/Regina is permanently UTC-6 (no DST).
 */
export function AutomationStack(ctx: StackContext, props: AutomationStackProps) {
    const { stack } = ctx;
    const { tableNames, tableArns } = props;

    // 00:01 America/Regina = 06:01 UTC (UTC-6, no DST)
    // EventBridge cron format: cron(minute hour day-of-month month day-of-week year)
    const cron = new Cron(stack, "ActivateScheduledQuestsCron", {
        schedule: "cron(1 6 * * ? *)",
        job: {
            function: {
                handler:
                    "packages/functions/src/questInstances/activateScheduledQuests.handler",
                environment: {
                    QUEST_INSTANCES_TABLE_NAME: tableNames.questInstancesTable,
                },
                timeout: 300,  // 5 min ceiling; typical run is <5 s
                memorySize: 256,
            },
        },
    });

    cron.attachPermissions([
        new iam.PolicyStatement({
            actions: ["dynamodb:Query", "dynamodb:UpdateItem"],
            resources: [
                tableArns.questInstancesTable,
                `${tableArns.questInstancesTable}/index/*`,
            ],
        }),
    ]);

    return {};
}

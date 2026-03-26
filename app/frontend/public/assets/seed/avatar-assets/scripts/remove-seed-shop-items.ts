/**
 * remove-seed-shop-items.ts
 *
 * Deletes the seeded shop items and their shop listings from DynamoDB.
 * Run this once to clean up items that were seeded but are now handled as rewards.
 *
 * Usage (from the repo root):
 *   npx tsx app/frontend/public/assets/seed/avatar-assets/scripts/remove-seed-shop-items.ts --stage "local#"
 */

import * as fs from "fs";
import * as path from "path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

function getArg(flag: string): string {
    const idx = process.argv.indexOf(flag);
    if (idx === -1 || !process.argv[idx + 1]) throw new Error(`Missing ${flag} argument`);
    return process.argv[idx + 1];
}

const STAGE = getArg("--stage");
const outputsPath = path.resolve(process.cwd(), "infra/.sst/outputs.json");
const outputs = JSON.parse(fs.readFileSync(outputsPath, "utf-8"));

function getOutput(stackName: string, outputKey: string): string {
    const fullStackName = `${STAGE}-classquest-${stackName}`;
    const val = outputs[fullStackName]?.[outputKey];
    if (!val) throw new Error(`Missing output '${outputKey}' in stack '${fullStackName}'`);
    return val;
}

const REGION = process.env.AWS_REGION ?? "ca-central-1";
const SHOP_ITEMS_TABLE = getOutput("ClassQuestDataStack", "shopItemsTable");
const SHOP_LISTINGS_TABLE = getOutput("ClassQuestDataStack", "shopListingsTable");

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

// All item IDs that were seeded and should be removed
const ITEM_IDS = [
    "guardian_helmet_copper",
    "guardian_armour_copper",
    "guardian_shield_copper",
    "healer_helmet_holy",
    "healer_armour_holy",
    "healer_shield_holy",
    "mage_helmet_crimson",
    "mage_armour_crimson",
    "mage_weapon_crimson",
    "pet_dog",
    "background_beginner_forest",
    "background_town",
];

// Listing keys: PK is SHOP#GLOBAL, SK is ACTIVEFROM#<date>#LISTING#<listing_id>
const LISTING_KEYS = [
    { SK: "ACTIVEFROM#2024-01-01T00:00:00.000Z#LISTING#listing_guardian_helmet_copper" },
    { SK: "ACTIVEFROM#2024-01-01T00:00:00.000Z#LISTING#listing_guardian_armour_copper" },
    { SK: "ACTIVEFROM#2024-01-01T00:00:00.000Z#LISTING#listing_guardian_shield_copper" },
    { SK: "ACTIVEFROM#2024-01-01T00:00:00.000Z#LISTING#listing_healer_helmet_holy" },
    { SK: "ACTIVEFROM#2024-01-01T00:00:00.000Z#LISTING#listing_healer_armour_holy" },
    { SK: "ACTIVEFROM#2024-01-01T00:00:00.000Z#LISTING#listing_healer_shield_holy" },
    { SK: "ACTIVEFROM#2024-01-01T00:00:00.000Z#LISTING#listing_mage_helmet_crimson" },
    { SK: "ACTIVEFROM#2024-01-01T00:00:00.000Z#LISTING#listing_mage_armour_crimson" },
    { SK: "ACTIVEFROM#2024-01-01T00:00:00.000Z#LISTING#listing_mage_weapon_crimson" },
    { SK: "ACTIVEFROM#2024-01-01T00:00:00.000Z#LISTING#listing_pet_dog" },
    { SK: "ACTIVEFROM#2024-01-01T00:00:00.000Z#LISTING#listing_background_beginner_forest" },
    { SK: "ACTIVEFROM#2024-01-01T00:00:00.000Z#LISTING#listing_background_town" },
];

async function main() {
    console.log(`Deleting ${ITEM_IDS.length} shop items from ${SHOP_ITEMS_TABLE}...`);
    for (const item_id of ITEM_IDS) {
        await dynamo.send(new DeleteCommand({
            TableName: SHOP_ITEMS_TABLE,
            Key: { item_pk: `SHOPITEM#${item_id}`, item_sk: "META" },
        }));
        console.log(`  Deleted shop item: ${item_id}`);
    }

    console.log(`\nDeleting ${LISTING_KEYS.length} shop listings from ${SHOP_LISTINGS_TABLE}...`);
    for (const { SK } of LISTING_KEYS) {
        await dynamo.send(new DeleteCommand({
            TableName: SHOP_LISTINGS_TABLE,
            Key: { PK: "SHOP#GLOBAL", SK },
        }));
        console.log(`  Deleted listing: ${SK}`);
    }

    console.log("\nDone. All seeded shop items and listings have been removed.");
}

main().catch((err) => { console.error(err); process.exit(1); });

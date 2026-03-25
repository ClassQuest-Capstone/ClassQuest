/**
 * seed-avatar-system.ts
 *
 * Reads the three manifest files, uploads images to S3, and writes
 * the corresponding DynamoDB records for ShopItems, AvatarBases, and ShopListings.
 *
 * Usage: RUN FROM THE ROOT FOLDER and use your stage for seeding the data into the correct environment:
 *   npx tsx app/frontend/public/assets/seed/avatar-assets/scripts/seed-avatar-system.ts --stage "local#"
 *
 * Required env vars:   (reads from infra/.sst/outputs.json based on the stage)
 *   SHOP_ITEMS_TABLE_NAME
 *   AVATAR_BASES_TABLE_NAME
 *   SHOP_LISTINGS_TABLE_NAME
 *   ASSETS_BUCKET_NAME
 *   AWS_REGION          (default: ca-central-1)
 *
 * S3 key structure:
 *   seed/avatar-system/shop-items/{category}/{item_id}.png
 *   seed/avatar-system/avatar-bases/base/{avatar_base_id}.png   ← used in-game
 *   seed/avatar-system/avatar-bases/bg/{avatar_base_id}.png     ← used in welcome.tsx
 */

import * as fs from "fs";
import * as path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

// ── Config ────────────────────────────────────────────────────────────────────

function getArg(flag: string, required = true): string {
    const idx = process.argv.indexOf(flag);
    if (idx === -1 || !process.argv[idx + 1]) {
        if (required) throw new Error(`Missing ${flag} argument`);
        return "";
    }
    return process.argv[idx + 1];
}

function getStage(): string {
    return getArg("--stage");
}

const STAGE = getStage();

const outputsPath = path.resolve(process.cwd(), "infra/.sst/outputs.json");
const outputs = JSON.parse(fs.readFileSync(outputsPath, "utf-8"));

function getOutput(stackName: string, outputKey: string): string {
    const fullStackName = `${STAGE}-classquest-${stackName}`;
    const stackOutputs = outputs[fullStackName];

    if (!stackOutputs) {
        throw new Error(`Stack not found in outputs.json: ${fullStackName}`);
    }

    const value = stackOutputs[outputKey];
    if (!value) {
        throw new Error(
        `Missing output '${outputKey}' in stack '${fullStackName}'`,
        );
    }

    return value;
}

const REGION = process.env.AWS_REGION ?? "ca-central-1";
const ASSETS_BUCKET_NAME = getOutput("ClassQuestTeacherApiStack", "TeacherAssetsBucketName");
const SHOP_ITEMS_TABLE_NAME = getOutput("ClassQuestDataStack", "shopItemsTable");
const AVATAR_BASES_TABLE_NAME = getOutput("ClassQuestDataStack", "avatarBasesTable");
const SHOP_LISTINGS_TABLE_NAME = getOutput("ClassQuestDataStack", "shopListingsTable");
const REWARD_MILESTONES_TABLE_NAME =
    getArg("--reward-milestones-table", false) ||
    getOutput("ClassQuestDataStack", "rewardMilestonesTable");

const SEED_CLASS_ID = getArg("--class-id");
const SEED_TEACHER_ID = getArg("--teacher-id");




console.log({
    stage: STAGE,
    ASSETS_BUCKET_NAME,
    SHOP_ITEMS_TABLE_NAME,
    AVATAR_BASES_TABLE_NAME,
    SHOP_LISTINGS_TABLE_NAME,
    REWARD_MILESTONES_TABLE_NAME,
    SEED_CLASS_ID,
    SEED_TEACHER_ID,
});


// ── AWS clients ───────────────────────────────────────────────────────────────

const s3 = new S3Client({ region: REGION });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

// ── Manifest types ────────────────────────────────────────────────────────────

interface ShopItemManifest {
    item_id: string;
    name: string;
    description: string;
    category: string;
    rarity: string;
    gold_cost: number;
    required_level: number;
    is_cosmetic_only: boolean;
    gender: string;
    is_active: boolean;
    seed_local_file: string;
}

interface AvatarBaseManifest {
    avatar_base_id: string;
    gender: string;
    role_type: string;
    is_default: boolean;
    /** Local path to the plain character image (no background) — uploaded to S3 for in-game use. */
    seed_local_file: string;
    /** Local path to the character image WITH background — uploaded to S3 for welcome.tsx. Optional: omit if not yet available. */
    bg_seed_local_file?: string;
    default_helmet_item_id?: string;
    default_armour_item_id?: string;
    default_shield_item_id?: string;
    default_pet_item_id?: string;
    default_background_item_id?: string;
}

interface ShopListingManifest {
    shop_listing_id: string;
    item_id: string;
    available_from: string;
    available_to: string;
    is_active: boolean;
    display_order?: number;
}

interface RewardMilestoneManifest {
    reward_id: string;
    title: string;
    description: string;
    unlock_level: number;
    type: string;
    reward_target_type: string;
    reward_target_id: string;
    image_asset_key: string;
    is_active: boolean;
}

// ── Paths ─────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1");
const AVATAR_ASSETS_ROOT = path.resolve(__dirname, "..");
const MANIFESTS_DIR = path.join(AVATAR_ASSETS_ROOT, "manifests");

// ── S3 key builders ───────────────────────────────────────────────────────────

function shopItemS3Key(category: string, item_id: string): string {
    return `seed/avatar-system/shop-items/${category.toLowerCase()}/${item_id}.png`;
}

/** Plain character (no background) — used for in-game avatar rendering. */
function avatarBaseS3Key(avatar_base_id: string): string {
    return `seed/avatar-system/avatar-bases/base/${avatar_base_id}.png`;
}

/** Character with background baked in — used on the welcome/landing page. */
function avatarBaseBgS3Key(avatar_base_id: string): string {
    return `seed/avatar-system/avatar-bases/bg/${avatar_base_id}.png`;
}

// ── ShopItem DynamoDB key helpers ─────────────────────────────────────────────

function pad(n: number, digits: number): string {
    return String(n).padStart(digits, "0");
}

function buildShopItemKeys(
    item_id: string,
    category: string,
    required_level: number,
    gold_cost: number,
    rarity: string,
    is_active: boolean
) {
    const gsi1pk = is_active ? "SHOP#ACTIVE" : "SHOP#INACTIVE";
    const gsi1sk = [
        `CATEGORY#${category}`,
        `LEVEL#${pad(required_level, 3)}`,
        `PRICE#${pad(gold_cost, 6)}`,
        `RARITY#${rarity}`,
        `ITEM#${item_id}`,
    ].join("#");
    const gsi2pk = `CATEGORY#${category}`;
    const gsi2sk = [
        `LEVEL#${pad(required_level, 3)}`,
        `PRICE#${pad(gold_cost, 6)}`,
        `ITEM#${item_id}`,
    ].join("#");
    return {
        item_pk: `SHOPITEM#${item_id}`,
        item_sk: "META" as const,
        gsi1pk,
        gsi1sk,
        gsi2pk,
        gsi2sk,
    };
}

// ── ShopListing DynamoDB key helpers ──────────────────────────────────────────

function buildShopListingKeys(
    shop_listing_id: string,
    item_id: string,
    available_from: string,
    available_to: string,
    is_active: boolean
) {
    const PK = "SHOP#GLOBAL";
    const SK = `ACTIVEFROM#${available_from}#LISTING#${shop_listing_id}`;
    const listing_status = is_active ? "ACTIVE" : "INACTIVE";
    const GSI1PK = `SHOPVIEW#GLOBAL#${listing_status}`;
    const GSI1SK = `FROM#${available_from}#TO#${available_to}#ITEM#${item_id}#LISTING#${shop_listing_id}`;
    const GSI2PK = `ITEM#${item_id}`;
    const GSI2SK = `SHOP#GLOBAL#FROM#${available_from}#LISTING#${shop_listing_id}`;
    return { PK, SK, listing_status, GSI1PK, GSI1SK, GSI2PK, GSI2SK };
}

// ── Upload helper ─────────────────────────────────────────────────────────────

async function uploadToS3(localFilePath: string, s3Key: string): Promise<void> {
    const fileContent = fs.readFileSync(localFilePath);
    await s3.send(
        new PutObjectCommand({
            Bucket: ASSETS_BUCKET_NAME,
            Key: s3Key,
            Body: fileContent,
            ContentType: "image/png",
        })
    );
    console.log(`    Uploaded s3://${ASSETS_BUCKET_NAME}/${s3Key}`);
}

// ── Step 1: Seed ShopItems ────────────────────────────────────────────────────

async function seedShopItems(items: ShopItemManifest[]): Promise<void> {
    console.log(`\nSeeding ${items.length} ShopItems...`);
    const now = new Date().toISOString();

    for (const item of items) {
        console.log(`  [${item.item_id}]`);
        const localFile = path.join(AVATAR_ASSETS_ROOT, item.seed_local_file);
        const s3Key = shopItemS3Key(item.category, item.item_id);

        await uploadToS3(localFile, s3Key);

        const keys = buildShopItemKeys(
            item.item_id,
            item.category,
            item.required_level,
            item.gold_cost,
            item.rarity,
            item.is_active
        );

        await dynamo.send(
            new PutCommand({
                TableName: SHOP_ITEMS_TABLE_NAME,
                Item: {
                    ...keys,
                    item_id: item.item_id,
                    name: item.name,
                    description: item.description,
                    category: item.category,
                    rarity: item.rarity,
                    gold_cost: item.gold_cost,
                    required_level: item.required_level,
                    is_cosmetic_only: item.is_cosmetic_only,
                    gender: item.gender,
                    is_active: item.is_active,
                    sprite_path: s3Key,
                    asset_key: s3Key,
                    created_at: now,
                    updated_at: now,
                },
            })
        );
        console.log(`    DynamoDB write OK`);
    }
}

// ── Step 2: Seed AvatarBases ──────────────────────────────────────────────────

async function seedAvatarBases(bases: AvatarBaseManifest[]): Promise<void> {
    console.log(`\nSeeding ${bases.length} AvatarBases...`);
    const now = new Date().toISOString();

    for (const base of bases) {
        console.log(`  [${base.avatar_base_id}]`);

        // Upload plain base image (no background) — used in-game
        const baseLocalFile = path.join(AVATAR_ASSETS_ROOT, base.seed_local_file);
        const baseS3Key = avatarBaseS3Key(base.avatar_base_id);
        await uploadToS3(baseLocalFile, baseS3Key);

        // Upload bg image (with background) — used in welcome.tsx
        let bgS3Key: string | undefined;
        if (base.bg_seed_local_file) {
            const bgLocalFile = path.join(AVATAR_ASSETS_ROOT, base.bg_seed_local_file);
            bgS3Key = avatarBaseBgS3Key(base.avatar_base_id);
            await uploadToS3(bgLocalFile, bgS3Key);
        } else {
            console.log(`    No bg_seed_local_file — skipping bg upload`);
        }

        await dynamo.send(
            new PutCommand({
                TableName: AVATAR_BASES_TABLE_NAME,
                Item: {
                    avatar_base_id: base.avatar_base_id,
                    gender: base.gender,
                    role_type: base.role_type,
                    is_default: base.is_default,
                    // S3 key for the plain character (no background)
                    base_image_key: baseS3Key,
                    // S3 key for the character with background baked in (welcome.tsx)
                    ...(bgS3Key && { bg_base_image_key: bgS3Key }),
                    ...(base.default_helmet_item_id && { default_helmet_item_id: base.default_helmet_item_id }),
                    ...(base.default_armour_item_id && { default_armour_item_id: base.default_armour_item_id }),
                    ...(base.default_shield_item_id && { default_shield_item_id: base.default_shield_item_id }),
                    ...(base.default_pet_item_id && { default_pet_item_id: base.default_pet_item_id }),
                    ...(base.default_background_item_id && { default_background_item_id: base.default_background_item_id }),
                    created_at: now,
                    updated_at: now,
                },
            })
        );
        console.log(`    DynamoDB write OK`);
    }
}

// ── Step 3: Seed ShopListings ─────────────────────────────────────────────────

async function seedShopListings(listings: ShopListingManifest[]): Promise<void> {
    console.log(`\nSeeding ${listings.length} ShopListings...`);
    const now = new Date().toISOString();

    for (const listing of listings) {
        console.log(`  [${listing.shop_listing_id}]`);
        const keys = buildShopListingKeys(
            listing.shop_listing_id,
            listing.item_id,
            listing.available_from,
            listing.available_to,
            listing.is_active
        );

        await dynamo.send(
            new PutCommand({
                TableName: SHOP_LISTINGS_TABLE_NAME,
                Item: {
                    ...keys,
                    shop_listing_id: listing.shop_listing_id,
                    item_id: listing.item_id,
                    available_from: listing.available_from,
                    available_to: listing.available_to,
                    is_active: listing.is_active,
                    ...(listing.display_order !== undefined && { display_order: listing.display_order }),
                    created_at: now,
                    updated_at: now,
                },
            })
        );
        console.log(`    DynamoDB write OK`);
    }
}

// ── Step 4: Seed RewardMilestones ─────────────────────────────────────────────

function buildUnlockSort(is_active: boolean, unlock_level: number, type: string, reward_id: string): string {
    const prefix = is_active ? "ACTIVE" : "INACTIVE";
    const level = String(unlock_level).padStart(5, "0");
    return `${prefix}#${level}#${type}#${reward_id}`;
}

function buildTeacherSort(class_id: string, is_active: boolean, unlock_level: number, reward_id: string): string {
    const prefix = is_active ? "ACTIVE" : "INACTIVE";
    const level = String(unlock_level).padStart(5, "0");
    return `${class_id}#${prefix}#${level}#${reward_id}`;
}

async function seedRewardMilestones(milestones: RewardMilestoneManifest[]): Promise<void> {
    console.log(`\nSeeding ${milestones.length} RewardMilestones...`);
    const now = new Date().toISOString();

    for (const m of milestones) {
        console.log(`  [${m.reward_id}]`);
        await dynamo.send(
            new PutCommand({
                TableName: REWARD_MILESTONES_TABLE_NAME,
                Item: {
                    reward_id:              m.reward_id,
                    class_id:               SEED_CLASS_ID,
                    created_by_teacher_id:  SEED_TEACHER_ID,
                    title:                  m.title,
                    description:            m.description,
                    unlock_level:           m.unlock_level,
                    type:                   m.type,
                    reward_target_type:     m.reward_target_type,
                    reward_target_id:       m.reward_target_id,
                    image_asset_key:        m.image_asset_key,
                    is_active:              m.is_active,
                    is_deleted:             false,
                    unlock_sort:  buildUnlockSort(m.is_active, m.unlock_level, m.type, m.reward_id),
                    teacher_sort: buildTeacherSort(SEED_CLASS_ID, m.is_active, m.unlock_level, m.reward_id),
                    created_at: now,
                    updated_at: now,
                },
                // Skip if already seeded (same reward_id)
                ConditionExpression: "attribute_not_exists(reward_id)",
            })
        ).catch((err: any) => {
            if (err.name === "ConditionalCheckFailedException") {
                console.log(`    Already exists — skipped`);
            } else {
                throw err;
            }
        });
        console.log(`    DynamoDB write OK`);
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log("=== seed-avatar-system ===");
    console.log(`Bucket:                  ${ASSETS_BUCKET_NAME}`);
    console.log(`ShopItems table:         ${SHOP_ITEMS_TABLE_NAME}`);
    console.log(`AvatarBases table:       ${AVATAR_BASES_TABLE_NAME}`);
    console.log(`ShopListings table:      ${SHOP_LISTINGS_TABLE_NAME}`);
    console.log(`RewardMilestones table:  ${REWARD_MILESTONES_TABLE_NAME}`);
    console.log(`Seed class ID:           ${SEED_CLASS_ID}`);
    console.log(`Seed teacher ID:         ${SEED_TEACHER_ID}`);
    console.log(`Region:                  ${REGION}`);

    const shopItems: ShopItemManifest[] = JSON.parse(
        fs.readFileSync(path.join(MANIFESTS_DIR, "shop-items.json"), "utf-8")
    );
    const avatarBases: AvatarBaseManifest[] = JSON.parse(
        fs.readFileSync(path.join(MANIFESTS_DIR, "avatar-bases.json"), "utf-8")
    );
    const shopListings: ShopListingManifest[] = JSON.parse(
        fs.readFileSync(path.join(MANIFESTS_DIR, "shop-listings.json"), "utf-8")
    );
    const rewardMilestones: RewardMilestoneManifest[] = JSON.parse(
        fs.readFileSync(path.join(MANIFESTS_DIR, "reward-milestones.json"), "utf-8")
    );

    await seedShopItems(shopItems);
    await seedAvatarBases(avatarBases);
    await seedShopListings(shopListings);
    await seedRewardMilestones(rewardMilestones);

    console.log("\n=== Done ===");
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});

/**
 * seed-avatar-system.ts
 *
 * Reads the three manifest files, uploads images to S3, and writes
 * the corresponding DynamoDB records for ShopItems, AvatarBases, and ShopListings.
 *
 * Usage:
 *   npx tsx seed-avatar-system.ts
 *
 * Required env vars:
 *   SHOP_ITEMS_TABLE_NAME
 *   AVATAR_BASES_TABLE_NAME
 *   SHOP_LISTINGS_TABLE_NAME
 *   ASSETS_BUCKET_NAME
 *   AWS_REGION          (default: ca-central-1)
 *   AWS_PROFILE         (optional — uses default credential chain if absent)
 */

import * as fs from "fs";
import * as path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

// ── Config ────────────────────────────────────────────────────────────────────

const REGION = process.env.AWS_REGION ?? "ca-central-1";
const BUCKET = requireEnv("ASSETS_BUCKET_NAME");
const SHOP_ITEMS_TABLE = requireEnv("SHOP_ITEMS_TABLE_NAME");
const AVATAR_BASES_TABLE = requireEnv("AVATAR_BASES_TABLE_NAME");
const SHOP_LISTINGS_TABLE = requireEnv("SHOP_LISTINGS_TABLE_NAME");

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

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
    seed_local_file: string;
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

// ── Paths ─────────────────────────────────────────────────────────────────────

// __dirname = avatar-assets/scripts/
const AVATAR_ASSETS_ROOT = path.resolve(__dirname, "..");
const MANIFESTS_DIR = path.join(AVATAR_ASSETS_ROOT, "manifests");

// ── S3 key builders ───────────────────────────────────────────────────────────

function shopItemS3Key(category: string, item_id: string): string {
    return `seed/avatar-system/shop-items/${category.toLowerCase()}/${item_id}.png`;
}

function avatarBaseS3Key(avatar_base_id: string): string {
    return `seed/avatar-system/avatar-bases/${avatar_base_id}.png`;
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
            Bucket: BUCKET,
            Key: s3Key,
            Body: fileContent,
            ContentType: "image/png",
        })
    );
    console.log(`  Uploaded s3://${BUCKET}/${s3Key}`);
}

// ── Step 1: Seed ShopItems ────────────────────────────────────────────────────

async function seedShopItems(items: ShopItemManifest[]): Promise<void> {
    console.log(`\nSeeding ${items.length} ShopItems...`);
    const now = new Date().toISOString();

    for (const item of items) {
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
                TableName: SHOP_ITEMS_TABLE,
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
        console.log(`  Wrote ShopItem: ${item.item_id}`);
    }
}

// ── Step 2: Seed AvatarBases ──────────────────────────────────────────────────

async function seedAvatarBases(bases: AvatarBaseManifest[]): Promise<void> {
    console.log(`\nSeeding ${bases.length} AvatarBases...`);
    const now = new Date().toISOString();

    for (const base of bases) {
        const localFile = path.join(AVATAR_ASSETS_ROOT, base.seed_local_file);
        const s3Key = avatarBaseS3Key(base.avatar_base_id);

        await uploadToS3(localFile, s3Key);

        await dynamo.send(
            new PutCommand({
                TableName: AVATAR_BASES_TABLE,
                Item: {
                    avatar_base_id: base.avatar_base_id,
                    gender: base.gender,
                    role_type: base.role_type,
                    is_default: base.is_default,
                    base_image_key: base.avatar_base_id + ".png",
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
        console.log(`  Wrote AvatarBase: ${base.avatar_base_id}`);
    }
}

// ── Step 3: Seed ShopListings ─────────────────────────────────────────────────

async function seedShopListings(listings: ShopListingManifest[]): Promise<void> {
    console.log(`\nSeeding ${listings.length} ShopListings...`);
    const now = new Date().toISOString();

    for (const listing of listings) {
        const keys = buildShopListingKeys(
            listing.shop_listing_id,
            listing.item_id,
            listing.available_from,
            listing.available_to,
            listing.is_active
        );

        await dynamo.send(
            new PutCommand({
                TableName: SHOP_LISTINGS_TABLE,
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
        console.log(`  Wrote ShopListing: ${listing.shop_listing_id}`);
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log("=== seed-avatar-system ===");
    console.log(`Bucket:          ${BUCKET}`);
    console.log(`ShopItems table: ${SHOP_ITEMS_TABLE}`);
    console.log(`AvatarBases table: ${AVATAR_BASES_TABLE}`);
    console.log(`ShopListings table: ${SHOP_LISTINGS_TABLE}`);
    console.log(`Region:          ${REGION}`);

    const shopItems: ShopItemManifest[] = JSON.parse(
        fs.readFileSync(path.join(MANIFESTS_DIR, "shop-items.json"), "utf-8")
    );
    const avatarBases: AvatarBaseManifest[] = JSON.parse(
        fs.readFileSync(path.join(MANIFESTS_DIR, "avatar-bases.json"), "utf-8")
    );
    const shopListings: ShopListingManifest[] = JSON.parse(
        fs.readFileSync(path.join(MANIFESTS_DIR, "shop-listings.json"), "utf-8")
    );

    await seedShopItems(shopItems);
    await seedAvatarBases(avatarBases);
    await seedShopListings(shopListings);

    console.log("\n=== Done ===");
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});

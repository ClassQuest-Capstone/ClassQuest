import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { EquippedItems } from "./types.ts";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.EQUIPPED_ITEMS_TABLE_NAME;
if (!TABLE) throw new Error("Missing EQUIPPED_ITEMS_TABLE_NAME environment variable");

export const makeGsi1Pk = (class_id: string) => `CLASS#${class_id}`;
export const makeGsi1Sk = (student_id: string) => `STUDENT#${student_id}`;

export type PaginatedResult<T> = { items: T[]; cursor?: string };

export async function createEquippedItems(record: EquippedItems): Promise<void> {
    await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: record,
        ConditionExpression: "attribute_not_exists(equipped_id)",
    }));
}

export async function getEquippedItemsById(equipped_id: string): Promise<EquippedItems | null> {
    const result = await ddb.send(new GetCommand({ TableName: TABLE, Key: { equipped_id } }));
    return (result.Item as EquippedItems) ?? null;
}

export async function getEquippedItemsByClassAndStudent(class_id: string, student_id: string): Promise<EquippedItems | null> {
    const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :pk AND gsi1sk = :sk",
        ExpressionAttributeValues: {
            ":pk": makeGsi1Pk(class_id),
            ":sk": makeGsi1Sk(student_id),
        },
        Limit: 1,
    }));
    const items = result.Items as EquippedItems[];
    return items?.[0] ?? null;
}

export async function listEquippedItemsByClass(class_id: string, limit?: number, cursor?: string): Promise<PaginatedResult<EquippedItems>> {
    const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        IndexName: "gsi1",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": makeGsi1Pk(class_id) },
        Limit: limit,
        ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : undefined,
    }));
    return {
        items: (result.Items as EquippedItems[]) ?? [],
        cursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
            : undefined,
    };
}

export async function updateEquippedItems(
    equipped_id: string,
    updates: {
        avatar_base_id?: string;
        helmet_item_id?: string;
        armour_item_id?: string;
        hand_item_id?: string;
        pet_item_id?: string;
        background_item_id?: string;
        updated_at: string;
    }
): Promise<EquippedItems> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    const addField = (attr: string, value: any) => {
        const nameToken = `#${attr}`;
        const valueToken = `:${attr}`;
        updateExpressions.push(`${nameToken} = ${valueToken}`);
        expressionAttributeNames[nameToken] = attr;
        expressionAttributeValues[valueToken] = value;
    };

    if (updates.avatar_base_id      !== undefined) addField("avatar_base_id",      updates.avatar_base_id);
    if (updates.helmet_item_id      !== undefined) addField("helmet_item_id",      updates.helmet_item_id);
    if (updates.armour_item_id      !== undefined) addField("armour_item_id",      updates.armour_item_id);
    if (updates.hand_item_id        !== undefined) addField("hand_item_id",        updates.hand_item_id);
    if (updates.pet_item_id         !== undefined) addField("pet_item_id",         updates.pet_item_id);
    if (updates.background_item_id  !== undefined) addField("background_item_id",  updates.background_item_id);
    addField("updated_at", updates.updated_at);

    const result = await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { equipped_id },
        UpdateExpression: "SET " + updateExpressions.join(", "),
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: "attribute_exists(equipped_id)",
        ReturnValues: "ALL_NEW",
    }));

    return result.Attributes as EquippedItems;
}

/**
 * Clear a single slot field using DynamoDB REMOVE (sets it to absent/undefined).
 * Used by unequip when no AvatarBases default exists for the slot.
 */
export async function clearSlotField(equipped_id: string, slotField: string, updated_at: string): Promise<EquippedItems> {
    const result = await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { equipped_id },
        UpdateExpression: `REMOVE #slot SET #updated_at = :updated_at`,
        ExpressionAttributeNames: { "#slot": slotField, "#updated_at": "updated_at" },
        ExpressionAttributeValues: { ":updated_at": updated_at },
        ConditionExpression: "attribute_exists(equipped_id)",
        ReturnValues: "ALL_NEW",
    }));
    return result.Attributes as EquippedItems;
}

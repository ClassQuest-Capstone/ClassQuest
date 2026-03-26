import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { createEquippedItems, getEquippedItemsByClassAndStudent, makeGsi1Pk, makeGsi1Sk } from "./repo.ts";
import { getBase as getAvatarBase } from "../avatarBases/repo.ts";
import { validateCreateInput } from "./validation.ts";
import type { EquippedItems } from "./types.ts";

/**
 * POST /equipped-items
 *
 * Creates an EquippedItems record for a student in a class.
 * Slot defaults are read from AvatarBases using the provided avatar_base_id.
 * Returns 409 if a record already exists for this student+class combination.
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const rawBody = event.body;
        const body = typeof rawBody === "string" && rawBody.length ? JSON.parse(rawBody) : rawBody ?? {};

        const { class_id, student_id, avatar_base_id } = body;

        const validation = validateCreateInput({ class_id, student_id, avatar_base_id });
        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: validation.error }),
            };
        }

        // Prevent duplicate: one record per student per class
        const existing = await getEquippedItemsByClassAndStudent(class_id, student_id);
        if (existing) {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "EquippedItems record already exists for this student in this class",
                    equipped_id: existing.equipped_id,
                }),
            };
        }

        // Read AvatarBases to initialize slot defaults
        const base = await getAvatarBase(avatar_base_id);

        const now = new Date().toISOString();
        const record: EquippedItems = {
            equipped_id:        randomUUID(),
            class_id,
            student_id,
            avatar_base_id,
            helmet_item_id:     base?.default_helmet_item_id,
            armour_item_id:     base?.default_armour_item_id,
            hand_item_id:       base?.default_shield_item_id,  // AvatarBases uses shield naming
            pet_item_id:        base?.default_pet_item_id,
            background_item_id: base?.default_background_item_id,
            gsi1pk:             makeGsi1Pk(class_id),
            gsi1sk:             makeGsi1Sk(student_id),
            equipped_at:        now,
            updated_at:         now,
        };

        await createEquippedItems(record);

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: "EquippedItems created", ...record }),
        };
    } catch (error: any) {
        console.error("Error creating equipped items:", error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: error.message || "Internal server error" }),
        };
    }
};

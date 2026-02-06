import { randomUUID } from "crypto";
import type { QuestTemplateItem, QuestType, Difficulty } from "./types.ts";
import { createTemplate } from "./repo.ts";

const VALID_TYPES: QuestType[] = ["QUEST", "DAILY_QUEST", "BOSS_FIGHT"];
const VALID_DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

/**
 * POST /quest-templates
 * Create a new quest template
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify user is a teacher

    // Step 1: Parse request body
    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : rawBody ?? {};

    const {
        owner_teacher_id,
        title,
        description,
        subject,
        class_id,
        estimated_duration_minutes,
        base_xp_reward,
        base_gold_reward,
        is_shared_publicly,
        type,
        grade,
        difficulty,
    } = body;

    // Step 2: Validate required fields
    if (!owner_teacher_id || !title) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "MISSING_REQUIRED_FIELDS",
                message: "Required fields: owner_teacher_id, title",
            }),
        };
    }

    // Step 3: Validate field types and values
    if (typeof title !== "string" || title.trim() === "") {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_TITLE",
                message: "title must be a non-empty string",
            }),
        };
    }

    if (
        base_xp_reward !== undefined &&
        (typeof base_xp_reward !== "number" || base_xp_reward < 0)
    ) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_BASE_XP_REWARD",
                message: "base_xp_reward must be a non-negative number",
            }),
        };
    }

    if (
        base_gold_reward !== undefined &&
        (typeof base_gold_reward !== "number" || base_gold_reward < 0)
    ) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_BASE_GOLD_REWARD",
                message: "base_gold_reward must be a non-negative number",
            }),
        };
    }

    if (type !== undefined && !VALID_TYPES.includes(type as QuestType)) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_TYPE",
                message: `type must be one of: ${VALID_TYPES.join(", ")}`,
            }),
        };
    }

    if (
        difficulty !== undefined &&
        !VALID_DIFFICULTIES.includes(difficulty as Difficulty)
    ) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                error: "INVALID_DIFFICULTY",
                message: `difficulty must be one of: ${VALID_DIFFICULTIES.join(", ")}`,
            }),
        };
    }

    // Step 4: Generate IDs and timestamps
    const quest_template_id = randomUUID();
    const now = new Date().toISOString();

    // Step 5: Derive visibility_pk and public_sort
    const visibility_pk = is_shared_publicly === true ? "PUBLIC" : "PRIVATE";
    const public_sort = `${subject ?? ""}#${grade ?? ""}#${difficulty ?? ""}#${now}`;

    // Step 6: Create the quest template item
    const item: QuestTemplateItem = {
        quest_template_id,
        owner_teacher_id: owner_teacher_id.trim(),
        title: title.trim(),
        description: description ?? "",
        subject: subject ?? "",
        class_id: class_id ?? "",
        estimated_duration_minutes: estimated_duration_minutes ?? 0,
        base_xp_reward: base_xp_reward ?? 0,
        base_gold_reward: base_gold_reward ?? 0,
        is_shared_publicly: is_shared_publicly ?? false,
        type: (type ?? "QUEST") as QuestType,
        grade: grade ?? 5,
        difficulty: (difficulty ?? "MEDIUM") as Difficulty,
        visibility_pk,
        public_sort,
        created_at: now,
        updated_at: now,
    };

    try {
        await createTemplate(item);

        return {
            statusCode: 201,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                quest_template_id,
                message: "Quest template created successfully",
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    error: "TEMPLATE_ALREADY_EXISTS",
                    message: "A template with this ID already exists",
                }),
            };
        }

        console.error("Error creating quest template:", error);
        throw error;
    }
};

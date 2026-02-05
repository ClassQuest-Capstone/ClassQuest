import type { QuestType, Difficulty } from "./types.ts";
import { updateTemplate, getTemplate } from "./repo.ts";

const VALID_TYPES: QuestType[] = ["QUEST", "DAILY_QUEST", "BOSS_FIGHT"];
const VALID_DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

/**
 * PATCH /quest-templates/{quest_template_id}
 * Update quest template fields
 */
export const handler = async (event: any) => {
    // TODO AUTH: Verify user is the owner of this template

    const quest_template_id = event.pathParameters?.quest_template_id;

    if (!quest_template_id) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_QUEST_TEMPLATE_ID" }),
        };
    }

    // Step 1: Parse request body
    const rawBody = event?.body;
    const body =
        typeof rawBody === "string" && rawBody.length
            ? JSON.parse(rawBody)
            : rawBody ?? {};

    const {
        title,
        description,
        subject,
        subject_id,
        estimated_duration_minutes,
        base_xp_reward,
        base_gold_reward,
        is_shared_publicly,
        type,
        grade,
        difficulty,
    } = body;

    // Step 2: Validate field values if provided
    if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
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

    // Step 3: Fetch current template to check if we need to update GSI2 fields
    let existingTemplate;
    try {
        existingTemplate = await getTemplate(quest_template_id);
        if (!existingTemplate) {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "QUEST_TEMPLATE_NOT_FOUND" }),
            };
        }
    } catch (error) {
        console.error("Error fetching existing template:", error);
        throw error;
    }

    // Step 4: Build updates object
    const updates: any = {};

    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description;
    if (subject !== undefined) updates.subject = subject;
    if (estimated_duration_minutes !== undefined)
        updates.estimated_duration_minutes = estimated_duration_minutes;
    if (base_xp_reward !== undefined) updates.base_xp_reward = base_xp_reward;
    if (base_gold_reward !== undefined) updates.base_gold_reward = base_gold_reward;
    if (is_shared_publicly !== undefined)
        updates.is_shared_publicly = is_shared_publicly;
    if (type !== undefined) updates.type = type;
    if (grade !== undefined) updates.grade = grade;
    if (difficulty !== undefined) updates.difficulty = difficulty;

    // Step 5: Update derived fields if relevant fields changed
    const finalSubject = subject ?? existingTemplate.subject;
    const finalGrade = grade ?? existingTemplate.grade;
    const finalDifficulty = difficulty ?? existingTemplate.difficulty;
    const finalIsShared = is_shared_publicly ?? existingTemplate.is_shared_publicly;

    // Recalculate visibility_pk
    updates.visibility_pk = finalIsShared ? "PUBLIC" : "PRIVATE";

    // Recalculate public_sort (keep original created_at)
    updates.public_sort = `${finalSubject}#${finalGrade}#${finalDifficulty}#${existingTemplate.created_at}`;

    // Step 6: Perform update
    try {
        await updateTemplate(quest_template_id, updates);

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                message: "Quest template updated successfully",
                quest_template_id,
            }),
        };
    } catch (error: any) {
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ error: "QUEST_TEMPLATE_NOT_FOUND" }),
            };
        }

        console.error("Error updating quest template:", error);
        throw error;
    }
};

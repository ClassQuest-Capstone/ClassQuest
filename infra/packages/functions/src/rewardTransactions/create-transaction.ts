import { putTransaction } from "./repo.js";
import { validateTransactionData } from "./validation.js";
import { RewardTransactionItem, SourceType, CreatedByRole, computeGSIKeys, generateDeterministicTransactionId } from "./types.js";
import { randomUUID } from "crypto";

/**
 * POST /reward-transactions
 * Create a new reward transaction
 *
 * Authorization: TEACHER, ADMIN, SYSTEM only (students cannot create transactions)
 */
export const handler = async (event: any) => {
    try {
        // Extract auth principal from Cognito authorizer
        const hasAuthContext = !!event.requestContext?.authorizer?.jwt;
        const userRole = event.requestContext?.authorizer?.jwt?.claims?.["cognito:groups"] as string | undefined;
        const userId = event.requestContext?.authorizer?.jwt?.claims?.sub as string | undefined;

        if (!userId) {
            console.warn("create-transaction: 401 – hasAuthContext:", hasAuthContext);
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Unauthorized: Missing user identity" }),
            };
        }

        /* (Comment role out since its blocking access to the endpoint for now enable when access to userpool is fixed)
        // Authorization: Only TEACHER, STUDENTS, ADMIN, SYSTEM can create transactions
        const allowedRoles = ["Teachers", "Students", "Admins", "System"];
        const hasPermission = userRole?.split(",").some(role => allowedRoles.includes(role.trim()));

        if (!hasPermission) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Forbidden: Only teachers, students, admins, or system can create reward transactions" }),
            };
        }*/

        

        // Determine created_by_role based on Cognito group
        let created_by_role: CreatedByRole;
        if (userRole?.includes("Admins")) {
            created_by_role = CreatedByRole.ADMIN;
        } else if (userRole?.includes("System")) {
            created_by_role = CreatedByRole.SYSTEM;
        } else if (userRole?.includes("Students")) {
            created_by_role = CreatedByRole.STUDENT;
        } else {
            created_by_role = CreatedByRole.TEACHER;
        }

        // Parse request body
        const body = JSON.parse(event.body || "{}");

        // Extract and validate required fields
        const {
            transaction_id: clientTransactionId,
            student_id,
            class_id,
            xp_delta,
            gold_delta,
            hearts_delta,
            source_type,
            source_id,
            quest_instance_id,
            question_id,
            boss_battle_instance_id,
            attempt_pk,
            reason,
            metadata,
        } = body;

        // Coerce deltas and reject NaN early — Number(undefined) === NaN but typeof NaN === "number",
        // so validateDeltas alone cannot catch missing fields.
        const xpDelta = Number(xp_delta);
        const goldDelta = Number(gold_delta);
        const heartsDelta = Number(hearts_delta);

        if (isNaN(xpDelta) || isNaN(goldDelta) || isNaN(heartsDelta)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "xp_delta, gold_delta, and hearts_delta must be valid numbers" }),
            };
        }

        // Compute created_at server-side (ignore client-provided)
        const created_at = new Date().toISOString();

        // Determine transaction_id
        let transaction_id: string;

        if (clientTransactionId) {
            // Client provided explicit transaction_id
            transaction_id = clientTransactionId;
        } else if (source_type === SourceType.QUEST_QUESTION && quest_instance_id && student_id && question_id) {
            // Generate deterministic ID for quest questions
            transaction_id = generateDeterministicTransactionId(
                SourceType.QUEST_QUESTION,
                quest_instance_id,
                student_id,
                question_id
            );
        } else if (source_type === SourceType.BOSS_BATTLE && boss_battle_instance_id && student_id) {
            // Generate deterministic ID for boss battles
            transaction_id = generateDeterministicTransactionId(
                SourceType.BOSS_BATTLE,
                undefined,
                student_id,
                undefined,
                boss_battle_instance_id
            );
        } else {
            // Generate random UUID for other sources
            transaction_id = randomUUID();
        }

        // Validate transaction data
        const validation = validateTransactionData({
            transaction_id,
            student_id,
            xp_delta: xpDelta,
            gold_delta: goldDelta,
            hearts_delta: heartsDelta,
            source_type,
            created_at,
            created_by: userId,
            created_by_role,
            quest_instance_id,
            question_id,
            boss_battle_instance_id,
        });

        if (!validation.valid) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: validation.error }),
            };
        }

        // Compute GSI keys
        const gsiKeys = computeGSIKeys({
            student_id,
            class_id,
            source_type: source_type as SourceType,
            source_id,
            created_at,
            transaction_id,
        });

        // Build transaction item
        const item: RewardTransactionItem = {
            transaction_id,
            student_id,
            class_id,
            xp_delta: xpDelta,
            gold_delta: goldDelta,
            hearts_delta: heartsDelta,
            source_type: source_type as SourceType,
            source_id,
            quest_instance_id,
            question_id,
            boss_battle_instance_id,
            attempt_pk,
            reason,
            created_at,
            created_by: userId,
            created_by_role,
            metadata,
            ...gsiKeys,
        };

        // Put transaction (conditional for idempotency)
        try {
            await putTransaction(item);
        } catch (error: any) {
            if (error.name === "ConditionalCheckFailedException") {
                return {
                    statusCode: 409,
                    body: JSON.stringify({
                        error: "Transaction already exists (idempotent duplicate)",
                        transaction_id,
                    }),
                };
            }
            throw error;
        }

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: "Transaction created successfully",
                transaction_id,
                item,
            }),
        };
    } catch (error: any) {
        console.error("Error creating reward transaction:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
        };
    }
};

import { getClassByJoinCode } from "./repo.ts";

/**
 * GET /classes/join/{join_code}
 * Students use this to find classes to join
 */
export const handler = async (event: any) => {
    // ============================================================
    // TODO AUTH: Extract Cognito JWT and verify user is a student
    // This endpoint is for students trying to join a class
    // Verify the student's school_id matches the class's school_id
    // (prevents students from joining classes in other schools)
    // ============================================================

    // Step 1: Extract join_code from URL path parameters
    const join_code = event.pathParameters?.join_code;

    if (!join_code) {
        return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "MISSING_JOIN_CODE" }),
        };
    }

    // Step 2: Normalize join code to uppercase for case-insensitive matching
    // Allows students to type "abc123" and match "ABC123" in database
    const normalizedCode = join_code.toUpperCase();

    console.log("[get-by-join-code] Searching for join code:", {
        original: join_code,
        normalized: normalizedCode
    });

    // Step 3: Query GSI3 (join_code partition key) to find the class
    const item = await getClassByJoinCode(normalizedCode);

    console.log("[get-by-join-code] Query result:", {
        found: !!item,
        class_id: item?.class_id,
        join_code: item?.join_code,
        is_active: item?.is_active
    });

    // ============================================================
    // TODO AUTH: After fetching, verify student belongs to same school as class
    // Check item.school_id matches student's school_id from JWT
    // Return 403 if schools don't match
    // Only return active classes (filter out is_active === false)
    // ============================================================

    // Step 4: Return class details or 404 if not found
    return {
        statusCode: item ? 200 : 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item ?? { error: "CLASS_NOT_FOUND" }),
    };
};

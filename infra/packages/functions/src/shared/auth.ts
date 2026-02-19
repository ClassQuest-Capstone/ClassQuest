import { APIGatewayProxyEventV2 } from "aws-lambda";

export type AuthContext = {
    sub: string;              // Cognito user ID (same as student_id/teacher_id)
    username: string;         // Cognito username
    groups: string[];         // Cognito groups (Students, Teachers, etc.)
    role: "student" | "teacher";
};

export class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number = 401) {
        super(message);
        this.statusCode = statusCode;
        this.name = "AuthError";
    }
}

/**
 * Extract and validate JWT token from Authorization header
 * NOTE: This is a temporary implementation. In production, use API Gateway JWT authorizer.
 *
 * @param event API Gateway event
 * @returns AuthContext with user information
 * @throws AuthError if authentication fails
 */
export async function getAuthContext(event: APIGatewayProxyEventV2): Promise<AuthContext> {
    const authHeader = event.headers.authorization || event.headers.Authorization;

    if (!authHeader) {
        throw new AuthError("Missing Authorization header", 401);
    }

    // Extract token (format: "Bearer <token>")
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        throw new AuthError("Invalid Authorization header format. Expected: Bearer <token>", 401);
    }

    const token = parts[1];

    // Decode JWT without verification (TEMPORARY - API Gateway authorizer should do this)
    // JWT format: header.payload.signature
    const jwtParts = token.split(".");
    if (jwtParts.length !== 3) {
        throw new AuthError("Invalid JWT format", 401);
    }

    let payload: any;
    try {
        const base64Payload = jwtParts[1];
        const decodedPayload = Buffer.from(base64Payload, "base64").toString("utf8");
        payload = JSON.parse(decodedPayload);
    } catch (err) {
        throw new AuthError("Failed to decode JWT payload", 401);
    }

    const sub = payload.sub;
    const username = payload["cognito:username"];
    const groups = payload["cognito:groups"] || [];

    if (!sub || !username) {
        throw new AuthError("Invalid JWT: missing sub or username", 401);
    }

    // Check token expiration
    const exp = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    if (exp && exp < now) {
        throw new AuthError("JWT token expired", 401);
    }

    // Determine role from groups
    // NOTE: TeachersPending is treated as valid teacher role until approval workflow is implemented.
    // When approval workflow exists, consider adding granular permissions based on group.
    let role: "student" | "teacher";
    if (groups.includes("Teachers") || groups.includes("TeachersPending")) {
        role = "teacher";
    } else if (groups.includes("Students")) {
        role = "student";
    } else {
        throw new AuthError("User not in valid group (Students, Teachers, or TeachersPending)", 403);
    }

    return {
        sub,
        username,
        groups,
        role,
    };
}

/**
 * Verify user is a teacher
 * @param auth AuthContext from getAuthContext
 * @throws AuthError if user is not a teacher
 */
export function requireTeacher(auth: AuthContext): void {
    if (auth.role !== "teacher") {
        throw new AuthError("Forbidden: Teacher access required", 403);
    }
}

/**
 * Verify user is a student
 * @param auth AuthContext from getAuthContext
 * @throws AuthError if user is not a student
 */
export function requireStudent(auth: AuthContext): void {
    if (auth.role !== "student") {
        throw new AuthError("Forbidden: Student access required", 403);
    }
}

/**
 * Get client IP address for audit logging
 * @param event API Gateway event
 * @returns Client IP address or "unknown"
 */
export function getClientIp(event: APIGatewayProxyEventV2): string {
    return event.requestContext?.http?.sourceIp || "unknown";
}

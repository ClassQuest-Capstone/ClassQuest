import { APIGatewayProxyEventV2 } from "aws-lambda";
import { CognitoIdentityProviderClient, AdminSetUserPasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import { getAuthContext, requireTeacher, getClientIp, AuthError } from "../shared/auth.ts";
import { getStudentProfile } from "./repo.ts";
import { getTeacherProfile } from "../teacher-profiles/repo.ts";
import { validatePassword } from "./validation.ts";

const cognitoClient = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID!;

/**
 * POST /students/{student_id}/set-password
 * Teacher sets a permanent password for a student
 *
 * Authorization: Teachers only, same school_id as student
 *
 * Request Body:
 * {
 *   "password": "string"  // min 6 chars, Cognito policy enforced
 * }
 *
 * Response: 204 No Content on success
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        // Step 1: Authenticate and authorize teacher
        const auth = await getAuthContext(event);
        requireTeacher(auth);

        const teacher_id = auth.sub;

        // Step 2: Extract student_id from path
        const student_id = event.pathParameters?.student_id;
        if (!student_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing student_id in path" }),
            };
        }

        // Step 3: Parse and validate request body
        const body = JSON.parse(event.body || "{}");
        const { password } = body;

        const validationErrors = validatePassword(password);
        if (validationErrors.length > 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: "Validation failed",
                    details: validationErrors
                }),
            };
        }

        // Step 4: Verify student exists
        const studentProfile = await getStudentProfile(student_id);
        if (!studentProfile) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Student not found" }),
            };
        }

        // Step 5: Verify teacher can manage this student (same school)
        const teacherProfile = await getTeacherProfile(teacher_id);
        if (!teacherProfile) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Teacher profile not found" }),
            };
        }

        if (teacherProfile.school_id !== studentProfile.school_id) {
            return {
                statusCode: 403,
                body: JSON.stringify({
                    error: "Forbidden: Cannot manage student from different school"
                }),
            };
        }

        // Step 6: Set password in Cognito (Permanent=true)
        await cognitoClient.send(
            new AdminSetUserPasswordCommand({
                UserPoolId: USER_POOL_ID,
                Username: student_id,  // Cognito username = student_id
                Password: password,
                Permanent: true,
            })
        );

        // Step 7: Audit logging (structured JSON for CloudWatch)
        const clientIp = getClientIp(event);
        console.log(JSON.stringify({
            action: "SET_STUDENT_PASSWORD",
            teacher_id,
            student_id,
            school_id: teacherProfile.school_id,
            timestamp: new Date().toISOString(),
            client_ip: clientIp,
        }));

        // Step 8: Return success (no body for 204)
        return {
            statusCode: 204,
            body: "",
        };

    } catch (err: any) {
        console.error("Error setting student password:", err);

        // Handle auth errors
        if (err instanceof AuthError) {
            return {
                statusCode: err.statusCode,
                body: JSON.stringify({ error: err.message }),
            };
        }

        // Handle Cognito errors
        if (err.name === "UserNotFoundException") {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Student not found in Cognito" }),
            };
        }

        if (err.name === "InvalidPasswordException") {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: "Password does not meet Cognito password policy requirements"
                }),
            };
        }

        if (err.name === "InvalidParameterException") {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: err.message || "Invalid parameter" }),
            };
        }

        // Generic error
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || "Internal server error" }),
        };
    }
};

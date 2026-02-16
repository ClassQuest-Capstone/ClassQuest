import { APIGatewayProxyEventV2 } from "aws-lambda";
import { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } from "@aws-sdk/client-cognito-identity-provider";
import { getAuthContext, getClientIp, AuthError } from "../shared/auth.ts";
import { updateStudentProfile, getStudentProfile, getStudentProfileByUsername } from "./repo.ts";
import { getTeacherProfile } from "../teacher-profiles/repo.ts";
import { validateUsername } from "./validation.ts";

const cognitoClient = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID!;

/**
 * PATCH /student-profiles/{student_id}
 *
 * Authorization:
 * - Students: Can update display_name only for their own profile
 * - Teachers: Can update display_name AND username for students in their school
 *
 * Request Body:
 * {
 *   "display_name": "string" (optional),
 *   "username": "string" (optional, teachers only)
 * }
 */
export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        // Step 1: Authenticate user
        const auth = await getAuthContext(event);

        // Step 2: Extract student_id from path
        const student_id = event.pathParameters?.student_id;
        if (!student_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing student_id in path" }),
            };
        }

        // Step 3: Parse request body
        const body = JSON.parse(event.body || "{}");
        const { display_name, username } = body;

        // Step 4: Verify student profile exists
        const existingProfile = await getStudentProfile(student_id);
        if (!existingProfile) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Student profile not found" }),
            };
        }

        // Step 5: Authorization logic
        const isStudent = auth.role === "student";
        const isTeacher = auth.role === "teacher";

        // Students can only update their own profile and only display_name
        if (isStudent) {
            if (auth.sub !== student_id) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({ error: "Forbidden: Cannot update other student profiles" }),
                };
            }

            if (username !== undefined) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({ error: "Forbidden: Students cannot change username" }),
                };
            }
        }

        // Teachers can update any student in their school
        if (isTeacher) {
            const teacherProfile = await getTeacherProfile(auth.sub);
            if (!teacherProfile) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({ error: "Teacher profile not found" }),
                };
            }

            if (teacherProfile.school_id !== existingProfile.school_id) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({
                        error: "Forbidden: Cannot manage student from different school"
                    }),
                };
            }
        }

        // Step 6: Build updates object
        const updates: { display_name?: string; username?: string } = {};
        if (display_name !== undefined) {
            updates.display_name = display_name;
        }
        if (username !== undefined) {
            updates.username = username;
        }

        if (Object.keys(updates).length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "No valid fields to update" }),
            };
        }

        // Step 7: Validate username if provided
        if (username !== undefined) {
            const usernameErrors = validateUsername(username);
            if (usernameErrors.length > 0) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        error: "Validation failed",
                        details: usernameErrors
                    }),
                };
            }

            // Check username uniqueness (case-insensitive)
            const normalizedUsername = username.trim().toLowerCase();
            const existingUsername = existingProfile.username.toLowerCase();

            if (normalizedUsername !== existingUsername) {
                const existingUser = await getStudentProfileByUsername(normalizedUsername);
                if (existingUser && existingUser.student_id !== student_id) {
                    return {
                        statusCode: 409,
                        body: JSON.stringify({ error: "Username already taken" }),
                    };
                }
            }
        }

        // Step 8: Update DynamoDB
        const updated = await updateStudentProfile(
            student_id,
            updates,
            existingProfile.username  // For conditional check
        );

        if (!updated) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Student profile not found" }),
            };
        }

        // Step 9: Sync username to Cognito if changed
        if (username !== undefined && username.trim().toLowerCase() !== existingProfile.username.toLowerCase()) {
            try {
                await cognitoClient.send(
                    new AdminUpdateUserAttributesCommand({
                        UserPoolId: USER_POOL_ID,
                        Username: student_id,
                        UserAttributes: [
                            {
                                Name: "custom:username",
                                Value: username.trim(),
                            },
                        ],
                    })
                );

                // Audit log for username change
                const clientIp = getClientIp(event);
                console.log(JSON.stringify({
                    action: "UPDATE_STUDENT_USERNAME",
                    actor_id: auth.sub,
                    actor_role: auth.role,
                    student_id,
                    old_username: existingProfile.username,
                    new_username: username.trim(),
                    school_id: existingProfile.school_id,
                    timestamp: new Date().toISOString(),
                    client_ip: clientIp,
                }));
            } catch (cognitoErr: any) {
                console.error("Failed to sync username to Cognito:", cognitoErr);
                // Don't fail the entire request, DynamoDB is source of truth
            }
        }

        // Step 10: Return success
        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, student_id }),
        };

    } catch (err: any) {
        console.error("Error updating student profile:", err);

        // Handle auth errors
        if (err instanceof AuthError) {
            return {
                statusCode: err.statusCode,
                body: JSON.stringify({ error: err.message }),
            };
        }

        // Handle DynamoDB conditional check failure
        if (err.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "Concurrent update conflict or username changed" }),
            };
        }

        // Generic error
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || "Internal server error" }),
        };
    }
};

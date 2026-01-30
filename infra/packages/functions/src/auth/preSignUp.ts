import type { PreSignUpTriggerEvent } from "aws-lambda";

export const handler = async (event: PreSignUpTriggerEvent) => {
    const role = event.request.userAttributes?.["custom:role"] ?? "";
    const email = event.request.userAttributes?.email;
    const username = event.userName;

    // Check if username is in email format
    const emailFormatRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailFormat = emailFormatRegex.test(username);

    console.log("[preSignUp] Processing signup", {
        username,
        "custom:role": role || "(missing)",
        hasEmail: !!email,
        isUsernameEmailFormat: isEmailFormat,
    });

    // Username cannot be in email format when email alias is enabled
    if (isEmailFormat) {
        console.error("[preSignUp] Username cannot be in email format", {
            username,
            role,
        });
        throw new Error(
            "Username cannot be an email address. " +
            (role === "TEACHER"
                ? "Please provide a username (e.g., 'john_teacher') and your email separately."
                : "Please provide a username without @ symbol.")
        );
    }

    if (role === "STUDENT") {
        // Students: username-only signup, auto-confirm, no email verification
        event.response.autoConfirmUser = true;
        event.response.autoVerifyEmail = false;
        event.response.autoVerifyPhone = false;
        console.log("[preSignUp] Auto-confirming student (username-only)");
    } else if (role === "TEACHER") {
        // Teachers: username + email signup, require email verification
        if (!email) {
            console.error("[preSignUp] Teacher signup missing email");
            throw new Error("Teachers must provide both username and email address");
        }
        // Email will be verified via confirmation code
        event.response.autoConfirmUser = false;
        event.response.autoVerifyEmail = true;
        console.log("[preSignUp] Teacher signup - email verification required", {
            username,
            email,
        });
    } else {
        console.error("[preSignUp] Invalid or missing custom:role", { role });
        throw new Error("Invalid role. Must be STUDENT or TEACHER");
    }

    return event;
};

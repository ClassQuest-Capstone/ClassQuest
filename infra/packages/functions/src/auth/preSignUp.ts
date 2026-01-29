import type { PreSignUpTriggerEvent } from "aws-lambda";

export const handler = async (event: PreSignUpTriggerEvent) => {
    const rawUserType = event.request.userAttributes?.["custom:userType"];
    const userType = rawUserType?.toLowerCase() ?? "";

    console.log("[preSignUp] Processing signup", {
        username: event.userName,
        "custom:userType": rawUserType || "(missing)",
        resolvedUserType: userType || "(empty)",
    });

    // Students: no email/phone verification, auto-confirm
    if (userType === "student") {
        event.response.autoConfirmUser = true;
        event.response.autoVerifyEmail = false;
        event.response.autoVerifyPhone = false;
        console.log("[preSignUp] Auto-confirming student");
    } else {
        console.log("[preSignUp] Teacher signup - email verification required");
    }

    // Teachers: do NOT auto-confirm; they must verify email
    return event;
};

import type { PreSignUpTriggerEvent } from "aws-lambda";

export const handler = async (event: PreSignUpTriggerEvent) => {
    const userType =
        event.request.userAttributes?.["custom:userType"]?.toLowerCase() ?? "";

    // Students: no email/phone verification, auto-confirm
    if (userType === "student") {
        event.response.autoConfirmUser = true;
        event.response.autoVerifyEmail = false;
        event.response.autoVerifyPhone = false;
    }

    // Teachers: do NOT auto-confirm; they must verify email
    return event;
};

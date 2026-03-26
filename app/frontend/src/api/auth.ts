import { api } from "./http.js";

export function teacherForgotPassword(email: string): Promise<{ ok: true }> {
    return api<{ ok: true }>("/auth/teacher/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
    });
}

export function teacherConfirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
): Promise<{ ok: true }> {
    return api<{ ok: true }>("/auth/teacher/confirm-forgot-password", {
        method: "POST",
        body: JSON.stringify({ email, code, newPassword }),
    });
}
